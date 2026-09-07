// Walk-forward (out-of-sample) backtest. Measures how often the composite
// score's direction matched the subsequent real move. This is a *historical*
// measure of behavior, clearly separate from the analytical confidence.

import { computeBias, scoreSeries, type IndicatorArrays } from "./signals";
import type { BacktestResult, Candle } from "./types";

export const BACKTEST_WARMUP = 180;

/**
 * Evaluate signal direction vs realized forward move over `horizonBars`.
 * Only bars where a non-neutral signal fired are counted.
 */
export function runBacktest(a: IndicatorArrays, candles: Candle[], horizonBars: number): BacktestResult {
  const n = candles.length;
  if (n - BACKTEST_WARMUP - horizonBars < 20) {
    return {
      hitRate: null,
      samples: 0,
      avgReturnPct: null,
      bias: null,
      horizonBars,
      note: "Not enough out-of-sample history to backtest this timeframe.",
    };
  }
  const scores = scoreSeries(a, candles);
  const wins: number[] = [];
  const returns: number[] = [];
  for (let i = BACKTEST_WARMUP; i <= n - horizonBars - 1; i++) {
    const bias = computeBias(scores[i]);
    if (bias === "neutral") continue;
    const entry = candles[i].close;
    const exit = candles[i + horizonBars].close;
    const fwd = ((exit - entry) / entry) * 100;
    wins.push((bias === "bullish" ? fwd > 0 : fwd < 0) ? 1 : 0);
    returns.push(fwd);
  }
  if (wins.length === 0) {
    return {
      hitRate: null,
      samples: 0,
      avgReturnPct: null,
      bias: null,
      horizonBars,
      note: "No qualifying signals in the out-of-sample window.",
    };
  }
  return {
    hitRate: wins.reduce((x, y) => x + y, 0) / wins.length,
    samples: wins.length,
    avgReturnPct: returns.reduce((x, y) => x + y, 0) / returns.length,
    bias: null,
    horizonBars,
    note: `Direction of the composite score compared with the actual price ${horizonBars} bar(s) later — historically observed, not a prediction of future returns.`,
  };
}