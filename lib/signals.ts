// Signal generation + composite scoring.
// Confidence here is an ANALYTICAL score (agreement/robustness), never a
// probability of profit. Backtests are separate, out-of-sample measures.

import {
  bollinger,
  ema,
  lastSlope,
  macd,
  obv,
  rateOfChange,
  rsi,
  sma,
  stochastic,
  atr,
  adx,
} from "./indicators";
import type { Candle, Signal, SignalBias } from "./types";

/** Series computed once and reused across signals, scoring and risk. */
export interface IndicatorArrays {
  ema20: (number | null)[];
  ema50: (number | null)[];
  sma200: (number | null)[];
  sma50: (number | null)[];
  rsi14: (number | null)[];
  macdLine: (number | null)[];
  macdSignal: (number | null)[];
  macdHist: (number | null)[];
  bbUpper: (number | null)[];
  bbLower: (number | null)[];
  bbMid: (number | null)[];
  bbWidth: (number | null)[];
  atrSeries: (number | null)[];
  atrPctSeries: (number | null)[];
  stochK: (number | null)[];
  stochD: (number | null)[];
  adxSeries: (number | null)[];
  volRatio: (number | null)[];
  obvSlope: number | null;
  returns: (number | null)[];
  /** 20-bar realized volatility of returns, annualized approximation. */
  stdevNow: number | null;
}

export function buildIndicators(candles: Candle[]): IndicatorArrays {
  const close = candles.map((c) => c.close);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const volume = candles.map((c) => c.volume);

  const ema20 = ema(close, 20);
  const ema50 = ema(close, 50);
  const sma200 = sma(close, 200);
  const sma50 = sma(close, 50);
  const rsi14 = rsi(close, 14);
  const { macd: macdLine, signal: macdSignal, hist: macdHist } = macd(close);
  const bb = bollinger(close, 20, 2);
  const atrSeries = atr(high, low, close, 14);
  const { k: stochK, d: stochD } = stochastic(high, low, close, 14, 3);
  const adxSeries = adx(high, low, close, 14);

  const atrPctSeries = atrSeries.map((v, i) =>
    v == null || close[i] === 0 ? null : (v / close[i]) * 100,
  );
  const bbWidth = bb.mid.map((m, i) =>
    m == null || m === 0 || bb.upper[i] == null || bb.lower[i] == null
      ? null
      : ((bb.upper[i]! - bb.lower[i]!) / m) * 100,
  );

  const smaVol = sma(volume, 20);
  const volRatio = volume.map((v, i) => (smaVol[i] == null || smaVol[i] === 0 ? null : v / smaVol[i]!));

  const returns = rateOfChange(close, 1).map((v) => (v == null ? null : v / 100));

  const obvSeries = obv(close, volume);
  const obvSlope = lastSlope(obvSeries.slice(-30), Math.min(30, obvSeries.length));

  // Annualized realized volatility from last 20 returns.
  let stdevNow: number | null = null;
  const recent = returns.slice(-20).filter((v): v is number => v != null);
  if (recent.length >= 2) {
    const mean = recent.reduce((x, y) => x + y, 0) / recent.length;
    const variance = recent.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (recent.length - 1);
    stdevNow = Math.sqrt(variance) * 15.81;
  }

  return {
    ema20,
    ema50,
    sma200,
    sma50,
    rsi14,
    macdLine,
    macdSignal,
    macdHist,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbMid: bb.mid,
    bbWidth,
    atrSeries,
    atrPctSeries,
    stochK,
    stochD,
    adxSeries,
    volRatio,
    obvSlope,
    returns,
    stdevNow,
  };
}

interface SignalDef {
  id: Signal["id"];
  name: string;
  group: Signal["group"];
  importance: number;
}

export const SIGNAL_DEFS: SignalDef[] = [
  { id: "trend-ema", name: "EMA trend alignment", group: "trend", importance: 20 },
  { id: "trend-long", name: "Long-term trend (200)", group: "trend", importance: 15 },
  { id: "trend-sma50", name: "Short-term trend (50)", group: "trend", importance: 8 },
  { id: "mom-macd", name: "MACD trend", group: "momentum", importance: 15 },
  { id: "mom-rsi", name: "RSI momentum", group: "momentum", importance: 12 },
  { id: "mom-stoch", name: "Stochastic", group: "momentum", importance: 8 },
  { id: "mom-hist", name: "MACD momentum", group: "momentum", importance: 10 },
  { id: "mr-boll", name: "Bollinger position", group: "mean-reversion", importance: 10 },
  { id: "mr-rsi", name: "RSI extremity", group: "mean-reversion", importance: 8 },
  { id: "vol-bbw", name: "Volatility expansion", group: "volatility", importance: 7 },
  { id: "vol-atr", name: "ATR volatility", group: "volatility", importance: 6 },
  { id: "vol-volume", name: "Volume confirmation", group: "volume", importance: 10 },
  { id: "vol-obv", name: "Volume flow (OBV)", group: "volume", importance: 8 },
];

export const TOTAL_IMPORTANCE = SIGNAL_DEFS.reduce((s, d) => s + d.importance, 0);

/**
 * Signals at the last bar. Every signal explains *why* it fired so the
 * prediction is transparent rather than a black box.
 */
export function generateSignals(a: IndicatorArrays, candles: Candle[], intervalLabel: string): Signal[] {
  const i = candles.length - 1;
  const price = candles[i].close;
  const signals: Signal[] = [];
  const fmt = (v: number | null | undefined, d = 1) => (v == null ? "n/a" : v.toFixed(d));

  const push = (def: SignalDef, bias: SignalBias, strength: number, detail: string, why: string, values?: Record<string, number>) => {
    const dir = bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0;
    const s = Math.max(0, Math.min(1, strength));
    signals.push({
      id: def.id,
      name: def.name,
      group: def.group,
      bias,
      strength: s,
      weight: dir * s * def.importance,
      detail,
      why,
      timeframe: intervalLabel,
      values,
    });
  };

  const e20 = a.ema20[i];
  const e50 = a.ema50[i];
  const s200 = a.sma200[i];
  const s50 = a.sma50[i];
  const m = a.macdLine[i];
  const ms = a.macdSignal[i];
  const mh = a.macdHist[i];
  const r14 = a.rsi14[i];
  const stK = a.stochK[i];
  const stD = a.stochD[i];
  const bu = a.bbUpper[i];
  const bl = a.bbLower[i];
  const vr = a.volRatio[i];
  const obvSlope = a.obvSlope;

  // --- Trend ---
  if (e20 != null && e50 != null) {
    const alignedUp = price > e20 && e20 > e50;
    const alignedDown = price < e20 && e20 < e50;
    const strength = Math.max(0.5, Math.min(1, Math.abs(price - e20) / (e20 / 100) + 0.6));
    push(
      { id: "trend-ema", name: "EMA trend alignment", group: "trend", importance: 20 },
      alignedUp ? "bullish" : alignedDown ? "bearish" : "neutral",
      alignedUp || alignedDown ? strength : 0.35,
      `Price ${fmt(price)} · EMA20 ${fmt(e20)} · EMA50 ${fmt(e50)}`,
      alignedUp
        ? "Price is above the 20- and 50-period EMAs with the faster EMA on top — the classic bullish alignment."
        : alignedDown
          ? "Price is below the 20- and 50-period EMAs with the faster EMA on the bottom — bearish alignment."
          : "EMAs are intertwined with price between them — no clear directional alignment.",
      { price, ema20: e20, ema50: e50 },
    );
  }
  if (s200 != null) {
    push(
      { id: "trend-long", name: "Long-term trend (200)", group: "trend", importance: 15 },
      price > s200 ? "bullish" : "bearish",
      0.8,
      `Price ${fmt(price)} vs SMA200 ${fmt(s200)}`,
      price > s200
        ? "Price is above the 200-period SMA — longer-term uptrend."
        : "Price is below the 200-period SMA — longer-term downtrend.",
      { price, sma200: s200 },
    );
  }
  if (s50 != null && candles.length >= 12) {
    const slope = lastSlope(candles.slice(-12).map((c) => c.close), 12);
    if (slope != null && Math.abs(slope) > 0.0015) {
      push(
        { id: "trend-sma50", name: "Short-term trend (50)", group: "trend", importance: 8 },
        slope > 0 ? "bullish" : "bearish",
        Math.min(1, Math.abs(slope) * 45),
        `Slope ${fmt(slope * 100, 2)}%/bar (12 bars)`,
        slope > 0
          ? "Closes have risen consistently over the last 12 bars."
          : "Closes have fallen consistently over the last 12 bars.",
        { slope: slope * 100 },
      );
    }
  }

  // --- Momentum ---
  if (m != null && ms != null) {
    push(
      { id: "mom-macd", name: "MACD trend", group: "momentum", importance: 15 },
      m > ms ? "bullish" : m < ms ? "bearish" : "neutral",
      0.7,
      `MACD ${fmt(m, 3)} vs signal ${fmt(ms, 3)}`,
      m > ms
        ? "MACD line is above its signal line — bullish momentum crossover region."
        : "MACD line is below its signal line — bearish momentum region.",
      { macd: m, signal: ms },
    );
  }
  if (r14 != null) {
    push(
      { id: "mom-rsi", name: "RSI momentum", group: "momentum", importance: 12 },
      r14 > 55 ? "bullish" : r14 < 45 ? "bearish" : "neutral",
      Math.min(1, Math.abs(r14 - 50) / 25),
      `RSI(14) = ${fmt(r14)}`,
      r14 > 55
        ? "RSI above 55 — buyers in control (positive momentum, not yet extreme)."
        : r14 < 45
          ? "RSI below 45 — sellers in control (negative momentum, not yet extreme)."
          : "RSI near 50 — momentum is balanced.",
      { rsi: r14 },
    );
  }
  if (stK != null && stD != null) {
    const up = stK > stD && stK > 50;
    const down = stK < stD && stK < 50;
    push(
      { id: "mom-stoch", name: "Stochastic", group: "momentum", importance: 8 },
      up ? "bullish" : down ? "bearish" : "neutral",
      0.6,
      `%K ${fmt(stK)} · %D ${fmt(stD)}`,
      up
        ? "Stochastic %K above %D in the upper half — short-term bullish impulse."
        : down
          ? "Stochastic %K below %D in the lower half — short-term bearish impulse."
          : "Stochastic shows no decisive cross.",
      { k: stK, d: stD },
    );
  }
  if (mh != null) {
    const rising = mh > 0 && mh > (a.macdHist[i - 1] ?? mh);
    const falling = mh < 0 && mh < (a.macdHist[i - 1] ?? mh);
    push(
      { id: "mom-hist", name: "MACD momentum", group: "momentum", importance: 10 },
      rising ? "bullish" : falling ? "bearish" : "neutral",
      0.55,
      `Histogram ${fmt(mh, 3)}`,
      rising
        ? "MACD histogram positive and expanding — buying pressure accelerating."
        : falling
          ? "MACD histogram negative and contracting — selling pressure accelerating."
          : "MACD histogram not clearly expanding.",
      { hist: mh },
    );
  }

  // --- Mean reversion ---
  if (bu != null && bl != null && bu !== bl) {
    const pos = (price - bl) / (bu - bl);
    let bias: SignalBias = "neutral";
    let strength = 0;
    let whyText = "Price is inside the middle of the Bollinger Bands — not stretched.";
    if (pos > 0.92) {
      bias = "bearish";
      strength = Math.min(1, (pos - 0.92) / 0.08 + 0.5);
      whyText = "Price is pressing the upper Bollinger Band — stretched, prone to a pullback.";
    } else if (pos < 0.08) {
      bias = "bullish";
      strength = Math.min(1, (0.08 - pos) / 0.08 + 0.5);
      whyText = "Price is hugging the lower Bollinger Band — oversold, prone to a bounce.";
    }
    push(
      { id: "mr-boll", name: "Bollinger position", group: "mean-reversion", importance: 10 },
      bias,
      strength,
      `Band position ${fmt(pos * 100, 0)}%`,
      whyText,
      { upper: bu, lower: bl, mid: a.bbMid[i] ?? price },
    );
  }
  if (r14 != null && (r14 > 70 || r14 < 30)) {
    push(
      { id: "mr-rsi", name: "RSI extremity", group: "mean-reversion", importance: 8 },
      r14 > 70 ? "bearish" : "bullish",
      Math.min(1, Math.abs(r14 - 50) / 30),
      `RSI(14) = ${fmt(r14)}`,
      r14 > 70
        ? "RSI above 70 — overbought; pullbacks are historically more likely."
        : "RSI below 30 — oversold; rebounds are historically more likely.",
      { rsi: r14 },
    );
  }

  // --- Volatility ---
  const bbw = a.bbWidth[i];
  const bbwPrev = a.bbWidth[i - 20];
  if (bbw != null && bbwPrev != null && bbwPrev > 0) {
    const expand = bbw / bbwPrev;
    push(
      { id: "vol-bbw", name: "Volatility expansion", group: "volatility", importance: 7 },
      expand > 1.15 ? (mh != null && mh > 0 ? "bullish" : "bearish") : "neutral",
      Math.min(1, Math.max(0, expand - 1) * 2.5),
      `Bandwidth ${fmt(bbw)}% · ×${fmt(expand, 2)} vs 20 bars ago`,
      expand > 1.15
        ? "Bollinger bandwidth expanded sharply — a strong directional move is underway; range-based signals are less reliable."
        : "Bandwidth stable/contracting — a range regime; trend signals carry less conviction.",
      { bandwidth: bbw, ratio: expand },
    );
  }
  const atrNow = a.atrPctSeries[i];
  const atrAvg = a.atrPctSeries.slice(-60).filter((x): x is number => x != null);
  if (atrNow != null && atrAvg.length >= 40) {
    const mean = atrAvg.reduce((x, y) => x + y, 0) / atrAvg.length;
    const hi = atrNow > mean * 1.25;
    push(
      { id: "vol-atr", name: "ATR volatility", group: "volatility", importance: 6 },
      hi ? (mh != null && mh > 0 ? "bullish" : "bearish") : "neutral",
      Math.min(1, Math.abs(atrNow - mean) / (mean || 1)),
      `ATR ${fmt(atrNow, 2)}% · 60-bar avg ${fmt(mean, 2)}%`,
      hi
        ? "Volatility well above its recent average — widen stops and be cautious with sizing assumptions."
        : "Volatility in line with recent norms.",
      { atrPct: atrNow, mean },
    );
  }

  // --- Volume ---
  if (vr != null) {
    const strong = vr > 1.25;
    push(
      { id: "vol-volume", name: "Volume confirmation", group: "volume", importance: 10 },
      strong ? (mh != null && mh > 0 ? "bullish" : "bearish") : "neutral",
      Math.min(1, Math.max(0, vr - 1) * 1.5 + 0.2),
      `Volume ×${fmt(vr, 2)} vs 20-bar average`,
      strong
        ? "Volume well above its 20-bar average — the current move is confirmed by participation."
        : "Volume unremarkable — the move is not emphatically confirmed.",
      { ratio: vr },
    );
  }
  if (obvSlope != null) {
    push(
      { id: "vol-obv", name: "Volume flow (OBV)", group: "volume", importance: 8 },
      obvSlope > 0 ? "bullish" : obvSlope < 0 ? "bearish" : "neutral",
      Math.min(1, Math.abs(obvSlope) * 8),
      `OBV slope ${fmt(obvSlope * 100, 2)}%/bar`,
      obvSlope > 0
        ? "On-Balance Volume rising — money flowing in on up-bars (accumulation)."
        : "On-Balance Volume falling — money flowing out on down-bars (distribution).",
      { slope: obvSlope * 100 },
    );
  }

  return signals;
}

/**
 * Composite score series (-100..100). Computed strictly causally (index i uses
 * only data up to i), so it is safe to reuse for walk-forward backtests.
 */
export function scoreSeries(a: IndicatorArrays, candles: Candle[]): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(0);
  const closes = candles.map((c) => c.close);
  const obvSeries = obv(closes, candles.map((c) => c.volume));

  for (let i = 0; i < n; i++) {
    let total = 0;
    let impSum = 0;
    const price = closes[i];
    const e20 = a.ema20[i];
    const e50 = a.ema50[i];
    if (e20 != null && e50 != null) {
      impSum += 20;
      total += (price > e20 && e20 > e50 ? 1 : price < e20 && e20 < e50 ? -1 : 0) * 18;
    }
    const s200 = a.sma200[i];
    if (s200 != null) {
      impSum += 15;
      total += (price > s200 ? 1 : -1) * 12;
    }
    const m = a.macdLine[i];
    const ms = a.macdSignal[i];
    if (m != null && ms != null) {
      impSum += 15;
      total += (m > ms ? 1 : -1) * 10.5;
    }
    const r14 = a.rsi14[i];
    if (r14 != null && r14 !== 50) {
      impSum += 12;
      total += (r14 > 50 ? 1 : -1) * 9 * Math.min(1, Math.abs(r14 - 50) / 50);
    }
    const mh = a.macdHist[i];
    if (mh != null) {
      impSum += 10;
      const prev = a.macdHist[i - 1];
      const rising = mh > 0 && (prev == null || mh > prev);
      const falling = mh < 0 && (prev == null || mh < prev);
      total += (rising ? 1 : falling ? -1 : 0) * 5.5;
    }
    const stK = a.stochK[i];
    const stD = a.stochD[i];
    if (stK != null && stD != null) {
      impSum += 8;
      total += (stK > stD && stK > 50 ? 1 : stK < stD && stK < 50 ? -1 : 0) * 4.8;
    }
    const bu = a.bbUpper[i];
    const bl = a.bbLower[i];
    if (bu != null && bl != null && bu !== bl) {
      impSum += 10;
      const pos = (price - bl) / (bu - bl);
      total += (pos > 0.92 ? -1 : pos < 0.08 ? 1 : 0) * 9;
    }
    if (r14 != null && (r14 > 70 || r14 < 30)) {
      impSum += 8;
      total += (r14 > 70 ? -1 : 1) * 6.4;
    }
    const vr = a.volRatio[i];
    if (vr != null && mh != null) {
      impSum += 10;
      total += (vr > 1.25 ? (mh > 0 ? 1 : -1) : 0) * 7;
    }
    if (i > 0) {
      const slope = lastSlope(obvSeries.slice(Math.max(0, i - 29), i + 1), Math.min(30, i + 1));
      if (slope != null && Math.abs(slope) > 0.02) {
        impSum += 8;
        total += (slope > 0 ? 1 : -1) * 5.6;
      }
    }
    out[i] = impSum === 0 ? 0 : Math.max(-100, Math.min(100, (total / impSum) * 100));
  }
  return out;
}

export function computeBias(score: number): SignalBias {
  if (score > 12) return "bullish";
  if (score < -12) return "bearish";
  return "neutral";
}