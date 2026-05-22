import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import {
  addIndicators, getSRLevels, scoreTimeframe, calculateTradePlan,
  gradeSignal, detectPatterns, analyzeMarketStructure,
  AnalysisResult, OHLCV
} from '@/lib/analyzer';

const exchange = new ccxt.binance({ enableRateLimit: true });

async function fetchOHLCV(symbol: string, timeframe: string, limit = 300): Promise<OHLCV[]> {
  const bars = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  return bars.map(b => ({
    timestamp: b[0] as number,
    open: b[1] as number,
    high: b[2] as number,
    low: b[3] as number,
    close: b[4] as number,
    volume: b[5] as number,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const { symbol, accountSize = 1000, riskPct = 1, rrRatio = 2 } = await req.json();

    if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

    const sym = symbol.toUpperCase();
    const timeframes = ['15m', '1h', '4h'];
    const tfResults = [];
    const adjScores: Record<string, number> = {};
    const rawScores: Record<string, number> = {};

    for (const tf of timeframes) {
      const bars = await fetchOHLCV(sym, tf, 300);
      const rows = addIndicators(bars);
      const { supports, resistances, allSup, allRes } = getSRLevels(rows, 6);
      const { raw, adj, detail } = scoreTimeframe(rows, supports, resistances, allSup, allRes);
      const patterns = detectPatterns(rows);
      const structure = analyzeMarketStructure(rows);
      adjScores[tf] = adj;
      rawScores[tf] = raw;
      tfResults.push({ tf, raw_score: raw, adj_score: adj, detail, supports, resistances, last: rows[rows.length - 1], patterns, market_structure: structure });
    }

    const tf4h = tfResults.find(t => t.tf === '4h')!;
    const price = tf4h.last.close;
    const vals = Object.values(adjScores);
    const total = vals.reduce((a, b) => a + b, 0);

    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (vals.every(s => s > 0) && total >= 5) signal = 'BUY';
    else if (vals.every(s => s < 0) && total <= -5) signal = 'SELL';

    const plan = signal !== 'NEUTRAL'
      ? calculateTradePlan(
          tfResults.find(t => t.tf === '4h')!.last ? [tf4h.last] : [],
          tf4h.supports, tf4h.resistances, signal, accountSize, riskPct, rrRatio
        )
      : null;

    // Use full 4h rows for plan calc
    const bars4h = await fetchOHLCV(sym, '4h', 300);
    const rows4h = addIndicators(bars4h);
    const { supports: s4h, resistances: r4h } = getSRLevels(rows4h, 6);
    const finalPlan = signal !== 'NEUTRAL'
      ? calculateTradePlan(rows4h, s4h, r4h, signal, accountSize, riskPct, rrRatio)
      : null;

    const { grade, text: grade_text } = gradeSignal(adjScores, signal, finalPlan);

    const last4h = tf4h.last;
    const bias = last4h.close > last4h.EMA200 ? 'MACRO BULL' : 'MACRO BEAR';

    const result: AnalysisResult = {
      symbol: sym,
      timestamp: Date.now(),
      price,
      timeframes: tfResults,
      signal,
      grade,
      grade_text,
      plan: finalPlan,
      adj_scores: adjScores,
      raw_scores: rawScores,
      bias,
      ema200: last4h.EMA200,
      atr_4h: last4h.ATR,
      adx_4h: last4h.ADX,
      vol_ratio_4h: last4h.Vol_ratio,
      struct_4h: tf4h.market_structure,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
