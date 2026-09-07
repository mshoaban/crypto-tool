// Orchestrator: turns OHLCV candles into a full, explainable analysis per
// timeframe, plus an overall multi-timeframe verdict.
//
// CONFIDENCE IS AN ANALYTICAL SCORE. It quantifies how well indicators agree,
// how much history was available, and how complete the indicator set is. It is
// NOT a probability of profit and is never labeled as one. Historical hit
// rates come only from the separate walk-forward backtest.

import { runBacktest } from "./backtest";
import { findLevels, computeRisk } from "./risk";
import { buildIndicators, generateSignals, computeBias, scoreSeries } from "./signals";
import type { TimeframeDef } from "./config";
import type {
  AnalysisResult,
  Candle,
  IndicatorSnapshot,
  OverallVerdict,
  SignalBias,
  TimeframeAnalysis,
} from "./types";

export const MIN_BARS = 90;
export const REQUIRED_BARS = 180;

export function computeConfidence(
  score: number,
  signals: { bias: SignalBias }[],
  barCount: number,
  completeness: number,
): { confidence: number; insufficientData: boolean } {
  const insufficientData = barCount < MIN_BARS;
  const cons = Math.abs(score) / 100;
  const nonNeutral = signals.filter((s) => s.bias !== "neutral");
  const agree =
    nonNeutral.length === 0
      ? 0
      : nonNeutral.filter((s) => s.bias === (score >= 0 ? "bullish" : "bearish")).length / nonNeutral.length;
  const dataQ = Math.min(1, Math.max(0, barCount / REQUIRED_BARS));
  let confidence = 100 * (0.45 * cons + 0.25 * agree + 0.2 * dataQ + 0.1 * completeness);
  if (insufficientData) confidence = Math.min(confidence, 25);
  return { confidence: Math.round(confidence * 10) / 10, insufficientData };
}

export function analyzeTimeframe(candles: Candle[], def: TimeframeDef): TimeframeAnalysis {
  const a = buildIndicators(candles);
  const i = candles.length - 1;
  const price = candles[i].close;
  const changePct =
    candles[i - 1]?.close ? ((price - candles[i - 1].close) / candles[i - 1].close) * 100 : 0;

  const signals = generateSignals(a, candles, def.label);
  const score = scoreSeries(a, candles)[i] ?? 0;
  const bias = computeBias(score);

  const levels = findLevels(candles, price);
  const risk = computeRisk(candles, a, price, bias, levels);

  // Indicator completeness at the last bar.
  const snapshot = makeSnapshot(a, i);
  const completions = [
    a.ema20[i], a.ema50[i], a.sma200[i], a.rsi14[i],
    a.macdLine[i], a.macdSignal[i], a.bbUpper[i], a.stochK[i], a.volRatio[i],
  ];
  const completeness = completions.filter((v) => v != null).length / completions.length;

  const { confidence, insufficientData } = computeConfidence(score, signals, candles.length, completeness);

  // Historical hit rate over a horizon that scales with the timeframe.
  const horizonBars = def.interval === "15m" ? 8 : def.interval === "1h" ? 8 : def.interval === "4h" ? 12 : 4;
  const backtest = runBacktest(a, candles, horizonBars);

  const agreement = signals.filter((s) => s.bias !== "neutral" && s.bias === bias).length;
  const consensus = signals.filter((s) => s.bias !== "neutral").length;

  return {
    interval: def.interval,
    label: def.label,
    score,
    bias,
    confidence,
    agreement,
    consensus,
    price,
    changePct,
    signals,
    levels,
    risk,
    indicators: snapshot,
    insufficientData,
    backtest,
  };
}

function makeSnapshot(a: ReturnType<typeof buildIndicators>, i: number): IndicatorSnapshot {
  return {
    sma20: a.sma50[i] ?? a.ema20[i],
    sma50: a.sma50[i],
    sma200: a.sma200[i],
    ema20: a.ema20[i],
    ema50: a.ema50[i],
    rsi14: a.rsi14[i],
    macd: a.macdLine[i],
    macdSignal: a.macdSignal[i],
    macdHist: a.macdHist[i],
    bollingerUpper: a.bbUpper[i],
    bollingerLower: a.bbLower[i],
    bollingerMid: a.bbMid[i],
    atr: a.atrSeries[i],
    atrPct: a.atrPctSeries[i],
    stochasticK: a.stochK[i],
    stochasticD: a.stochD[i],
    volumeRatio: a.volRatio[i],
    obvSlope: a.obvSlope,
    adx: a.adxSeries[i],
  };
}

/** Combine multiple timeframe analyses into an overall verdict. */
export function buildOverall(timeframes: TimeframeAnalysis[], defs: TimeframeDef[]): OverallVerdict {
  const used = timeframes.filter((t) => !t.insufficientData);
  if (used.length === 0) {
    return {
      bias: "neutral",
      score: 0,
      confidence: 0,
      summary: "Insufficient data across all timeframes to form a verdict.",
    };
  }
  let weightedScore = 0;
  let weightSum = 0;
  for (const t of used) {
    const w = defs.find((d) => d.interval === t.interval)?.weight ?? 1;
    weightedScore += t.score * w;
    weightSum += w;
  }
  const overallScore = weightedScore / weightSum;
  const bias = computeBias(overallScore);

  const biases = used.map((t) => t.bias);
  const agreeWithOverall = biases.filter((b) => b === bias || b === "neutral").length;
  const consensus = agreeWithOverall / biases.length;

  const avgConfidence = used.reduce((s, t) => s + (bias === t.bias ? t.confidence : 0), 0) / (used.filter((t) => t.bias === bias).length || 1);
  const confidence = Math.round(Math.min(100, avgConfidence * (0.6 + 0.4 * consensus)) * 10) / 10;

  const strongest = [...used].sort((x, y) => Math.abs(y.score) - Math.abs(x.score))[0];
  const short = used.find((t) => t.interval === "15m")?.bias;
  const long = used.find((t) => t.interval === "1d")?.bias;
  const parts: string[] = [`Aggregate bias is <strong>${bias}</strong> across ${used.length} reliable timeframe(s).`];
  if (strongest) parts.push(`Strongest read is on the ${strongest.label} chart (score ${strongest.score.toFixed(0)}).`);
  if (short && long && short !== long) {
    parts.push("Short- and long-term signals disagree — treat the read with extra caution.");
  }
  return { bias, score: overallScore, confidence, summary: parts.join(" ") };
}

export function buildAnalysisResult(
  symbol: string,
  symbolName: string,
  interval: string,
  candlesByInterval: Record<string, Candle[]>,
  defs: TimeframeDef[],
  asOf: number,
  fetchedAt: number,
  source: "binance" | "simulated",
): AnalysisResult {
  const mainDef = defs.find((d) => d.interval === interval) ?? defs[0];
  const main = candlesByInterval[mainDef.interval] ?? [];
  const price = main.length ? main[main.length - 1].close : 0;
  const changePct =
    main.length > 1 ? ((price - main[main.length - 2].close) / main[main.length - 2].close) * 100 : 0;

  const timeframes = defs
    .map((def) => {
      const candles = candlesByInterval[def.interval];
      if (!candles || candles.length === 0) return null;
      return analyzeTimeframe(candles, def);
    })
    .filter((t): t is TimeframeAnalysis => t != null);

  return {
    symbol,
    symbolName,
    interval,
    price,
    changePct,
    asOf,
    fetchedAt,
    source,
    overall: buildOverall(timeframes, defs),
    timeframes,
    insufficientData: timeframes.some((t) => t.insufficientData),
    simulated: source === "simulated",
  };
}