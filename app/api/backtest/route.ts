import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import {
  addIndicators, OHLCV, getSRLevels, scoreTimeframe, calculateTradePlan,
} from '@/lib/analyzer';

const exchange = new ccxt.binance({ enableRateLimit: true });

async function fetchOHLCV(symbol: string, timeframe: string, limit = 1000): Promise<OHLCV[]> {
  const bars = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  return bars.map(b => ({ timestamp: b[0] as number, open: b[1] as number, high: b[2] as number, low: b[3] as number, close: b[4] as number, volume: b[5] as number }));
}

type BacktestReq = { symbol: string; timeframe?: string; accountSize?: number; riskPct?: number; rrRatio?: number; limit?: number };

export async function POST(req: NextRequest) {
  try {
    const { symbol, timeframe = '1h', accountSize = 1000, riskPct = 1, rrRatio = 2, limit = 1000 } = await req.json() as BacktestReq;
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

    const sym = symbol.toUpperCase();
    const bars = await fetchOHLCV(sym, timeframe, limit);
    const rows = addIndicators(bars);

    const trades: any[] = [];
    let balance = accountSize;
    const equitySeries: { t: number; balance: number }[] = [];
    const priceSeries: { t: number; price: number }[] = [];

    let position: null | {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      entryIndex: number;
      units: number;
      sl: number;
      tp1: number; tp2: number; tp3: number;
      plan: any;
      partialTaken: boolean;
      reason: any;
    } = null;

    let peak = balance; let maxDD = 0;

    for (let i = 30; i < rows.length; i++) {
      const window = rows.slice(0, i + 1);
      const { supports, resistances, allSup, allRes } = getSRLevels(window, 6);
      const { adj, detail } = scoreTimeframe(window, supports, resistances, allSup, allRes);
      const adjScore = adj;
      priceSeries.push({ t: rows[i].timestamp, price: rows[i].close });
      equitySeries.push({ t: rows[i].timestamp, balance });

      // entry logic when flat
      if (!position) {
        if (adjScore >= 1.5) {
          // open long at next bar open (if exists)
          const entryIdx = Math.min(i + 1, rows.length - 1);
          const entryPrice = rows[entryIdx].open;
          const plan = calculateTradePlan(window.concat([rows[entryIdx]]), supports, resistances, 'BUY', accountSize, riskPct, rrRatio) || calculateTradePlan(window, supports, resistances, 'BUY', accountSize, riskPct, rrRatio);
          if (!plan) continue;
          position = {
            side: 'LONG', entryPrice, entryIndex: entryIdx, units: plan.position_size_units,
            sl: plan.stop_loss, tp1: plan.tp1, tp2: plan.tp2, tp3: plan.tp3, plan, partialTaken: false, reason: detail,
          };
        } else if (adjScore <= -1.5) {
          const entryIdx = Math.min(i + 1, rows.length - 1);
          const entryPrice = rows[entryIdx].open;
          const plan = calculateTradePlan(window.concat([rows[entryIdx]]), supports, resistances, 'SELL', accountSize, riskPct, rrRatio) || calculateTradePlan(window, supports, resistances, 'SELL', accountSize, riskPct, rrRatio);
          if (!plan) continue;
          position = {
            side: 'SHORT', entryPrice, entryIndex: entryIdx, units: plan.position_size_units,
            sl: plan.stop_loss, tp1: plan.tp1, tp2: plan.tp2, tp3: plan.tp3, plan, partialTaken: false, reason: detail,
          };
        }
      } else {
        // manage open position
        const bar = rows[i];
        if (position.side === 'LONG') {
          // check SL hit
          if (bar.low <= position.sl) {
            const exitPrice = position.sl;
            const pnl = position.units * (exitPrice - position.entryPrice);
            balance += pnl; trades.push({ side: 'LONG', entryIndex: position.entryIndex, exitIndex: i, entryPrice: position.entryPrice, exitPrice, pnl, reason: position.reason });
            position = null;
          } else if (!position.partialTaken && bar.high >= position.tp1) {
            // partial: record but keep running
            position.partialTaken = true;
          } else if (bar.high >= position.tp2) {
            const exitPrice = position.tp2;
            const pnl = position.units * (exitPrice - position.entryPrice);
            balance += pnl; trades.push({ side: 'LONG', entryIndex: position.entryIndex, exitIndex: i, entryPrice: position.entryPrice, exitPrice, pnl, reason: position.reason });
            position = null;
          }
        } else {
          // SHORT
          if (bar.high >= position.sl) {
            const exitPrice = position.sl;
            const pnl = position.units * (position.entryPrice - exitPrice);
            balance += pnl; trades.push({ side: 'SHORT', entryIndex: position.entryIndex, exitIndex: i, entryPrice: position.entryPrice, exitPrice, pnl, reason: position.reason });
            position = null;
          } else if (!position.partialTaken && bar.low <= position.tp1) {
            position.partialTaken = true;
          } else if (bar.low <= position.tp2) {
            const exitPrice = position.tp2;
            const pnl = position.units * (position.entryPrice - exitPrice);
            balance += pnl; trades.push({ side: 'SHORT', entryIndex: position.entryIndex, exitIndex: i, entryPrice: position.entryPrice, exitPrice, pnl, reason: position.reason });
            position = null;
          }
        }
      }

      if (balance > peak) peak = balance;
      const dd = (peak - balance) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    // if position still open, close at last close
    if (position) {
      const last = rows[rows.length - 1];
      const exitPrice = position.side === 'LONG' ? last.close : last.close;
      const pnl = position.side === 'LONG' ? position.units * (exitPrice - position.entryPrice) : position.units * (position.entryPrice - exitPrice);
      balance += pnl; trades.push({ side: position.side, entryIndex: position.entryIndex, exitIndex: rows.length - 1, entryPrice: position.entryPrice, exitPrice, pnl, reason: position.reason });
    }

    const totalPnL = balance - accountSize;
    const wins = trades.filter(t => t.pnl > 0).length;
    const winRate = trades.length ? (wins / trades.length) * 100 : 0;

    return NextResponse.json({
      symbol: sym,
      timeframe,
      accountSize,
      totalPnL,
      winRate,
      totalTrades: trades.length,
      finalBalance: balance,
      maxDrawdown: Math.round(maxDD * 10000) / 100,
      trades,
      equitySeries,
      priceSeries,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'backtest failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
