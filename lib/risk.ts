// Support/resistance and risk-management metrics (analysis only — never advice).

import type { IndicatorArrays } from "./signals";
import type { Candle, RiskMetrics, SignalBias, SupportResistance } from "./types";

/** Support/resistance from clustered pivot levels and recent swings. */
export function findLevels(candles: Candle[], price: number, window = 12): SupportResistance[] {
  const n = candles.length;
  if (n < window * 2 + 2) return [];
  const pivots: number[] = [];
  for (let i = window; i < n - window; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - window; j <= i + window; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    if (candles[i].high === hi) pivots.push(candles[i].high);
    if (candles[i].low === lo) pivots.push(candles[i].low);
  }
  const clustered: { level: number; touches: number }[] = [];
  for (const p of pivots) {
    const near = clustered.find((c) => Math.abs(c.level - p) / price < 0.004);
    if (near) near.touches += 1;
    else clustered.push({ level: p, touches: 1 });
  }
  return clustered
    .filter((c) => Math.abs(c.level - price) / price > 0.004) // skip the current price zone
    .map((c) => {
      const kind: "support" | "resistance" = c.level < price ? "support" : "resistance";
      const distancePct = Math.abs(c.level - price) / price;
      const label: "strong" | "moderate" | "weak" = c.touches >= 4 ? "strong" : c.touches >= 2 ? "moderate" : "weak";
      return { level: c.level, kind, touches: c.touches, distancePct, label };
    })
    .sort((x, y) => x.distancePct - y.distancePct)
    .slice(0, 6);
}

/**
 * Risk metrics for the current bias, including suggested stop / take-profit /
 * invalidation and risk:reward — framed purely as analysis.
 */
export function computeRisk(
  candles: Candle[],
  a: IndicatorArrays,
  price: number,
  bias: SignalBias,
  levels: SupportResistance[],
): RiskMetrics {
  const i = candles.length - 1;
  const atrV = a.atrSeries[i];
  const atrPct = a.atrPctSeries[i];

  // Realized volatility: std of log returns over 20 bars, annualized approx.
  let volatility = 0;
  const returns = a.returns.slice(-20).filter((v): v is number => v != null);
  if (a.stdevNow != null) {
    volatility = a.stdevNow;
  } else if (returns.length >= 2) {
    const mean = returns.reduce((x, y) => x + y, 0) / returns.length;
    const variance = returns.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (returns.length - 1);
    volatility = Math.sqrt(variance) * 15.81; // ~sqrt(250) annualization
  }

  const atrValue = atrV ?? price * 0.005;
  const atrPctVal = atrPct ?? 0.5;

  // Suggested stop / target based on bias and structure.
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;
  let invalidation: number | null = null;
  if (bias === "bullish") {
    const nearestSupport = levels.find((l) => l.kind === "support");
    const stop = Math.min(price - 1.5 * atrValue, nearestSupport ? nearestSupport.level : Infinity);
    stopLoss = stop < price ? stop : price - 1.5 * atrValue;
    const nearestResistance = levels.filter((l) => l.kind === "resistance").sort((x, y) => x.distancePct - y.distancePct)[0];
    takeProfit = nearestResistance ? nearestResistance.level : price + 3 * atrValue;
    // If nearest resistance is too close (< 1R), default to ATR target.
    if (price && stopLoss && takeProfit && Math.abs(takeProfit - price) < Math.abs(price - stopLoss) * 1.1) {
      takeProfit = price + 3 * atrValue;
    }
    invalidation = stopLoss;
  } else if (bias === "bearish") {
    const nearestResistance = levels.find((l) => l.kind === "resistance");
    const stop = Math.max(price + 1.5 * atrValue, nearestResistance ? nearestResistance.level : -Infinity);
    stopLoss = stop > price ? stop : price + 1.5 * atrValue;
    const nearestSupport = levels.filter((l) => l.kind === "support").sort((x, y) => x.distancePct - y.distancePct)[0];
    takeProfit = nearestSupport ? nearestSupport.level : price - 3 * atrValue;
    if (price && stopLoss && takeProfit && Math.abs(takeProfit - price) < Math.abs(price - stopLoss) * 1.1) {
      takeProfit = price - 3 * atrValue;
    }
    invalidation = stopLoss;
  }

  let riskReward: number | null = null;
  if (stopLoss != null && takeProfit != null && price) {
    const risk = Math.abs(price - stopLoss);
    const reward = Math.abs(takeProfit - price);
    if (risk > 0) riskReward = reward / risk;
  }

  let zScore = 0;
  const lastRet = a.returns[i];
  if (volatility > 0 && lastRet != null) {
    const mean = returns.length ? returns.reduce((x, y) => x + y, 0) / returns.length : 0;
    zScore = (lastRet - mean) / (volatility / Math.max(15.81, 1));
  }

  return {
    atrPct: atrPctVal,
    volatility,
    zScore,
    stopLoss,
    takeProfit,
    invalidation,
    riskReward,
    suggestedRiskPct: 1,
  };
}