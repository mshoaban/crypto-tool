// Technical indicator implementations.
// Every function returns an array aligned to the input length; entries that
// cannot be computed yet (insufficient history) are `null`.
// Formulas follow standard definitions (Wilder smoothing for RSI/ATR/ADX).

type Num = number | null;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function nanToNull(values: number[]): Num[] {
  return values.map((v) => (Number.isFinite(v) ? v : null));
}

export function sma(values: number[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average (standard smoothing factor 2/(period+1)). */
export function ema(values: number[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  // Seed with SMA of the first `period` values.
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Relative Strength Index — Wilder's smoothing. */
export function rsi(values: number[], period = 14): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Num[];
  signal: Num[];
  hist: Num[];
}

/** MACD(12,26,9) using EMAs. */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: Num[] = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null,
  );
  // Signal line computed over the non-null macd series (compact).
  const compactValues: number[] = macdLine.filter(isNum) as number[];
  const compactSignal = ema(compactValues, signalPeriod);
  const signal: Num[] = new Array(values.length).fill(null);
  const hist: Num[] = new Array(values.length).fill(null);
  let idx = 0;
  for (let i = 0; i < values.length; i++) {
    if (macdLine[i] != null) {
      const sig = compactSignal[idx];
      signal[i] = sig;
      hist[i] = macdLine[i]! - sig!;
      idx++;
    }
  }
  return { macd: macdLine, signal, hist };
}

export interface BollingerResult {
  mid: Num[];
  upper: Num[];
  lower: Num[];
}

/** Bollinger Bands (20, 2σ). */
export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const mid = sma(values, period);
  const upper: Num[] = new Array(values.length).fill(null);
  const lower: Num[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = mid[i]!;
    const variance = slice.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

/** Average True Range — Wilder's smoothing. */
export function atr(high: number[], low: number[], close: number[], period = 14): Num[] {
  const out: Num[] = new Array(close.length).fill(null);
  if (close.length <= period) return out;
  const tr: number[] = new Array(close.length).fill(0);
  tr[0] = high[0] - low[0];
  for (let i = 1; i < close.length; i++) {
    tr[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1]),
    );
  }
  let prev = 0;
  for (let i = 0; i <= period; i++) prev += tr[i];
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < close.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface StochasticResult {
  k: Num[];
  d: Num[];
}

/** Stochastic %K(14) with %D(3) SMA smoothing. */
export function stochastic(high: number[], low: number[], close: number[], kPeriod = 14, dPeriod = 3): StochasticResult {
  const kRaw: number[] = new Array(close.length).fill(0);
  for (let i = kPeriod - 1; i < close.length; i++) {
    const hi = Math.max(...high.slice(i - kPeriod + 1, i + 1));
    const lo = Math.min(...low.slice(i - kPeriod + 1, i + 1));
    kRaw[i] = hi === lo ? 50 : ((close[i] - lo) / (hi - lo)) * 100;
  }
  const k = nanToNull(kRaw);
  const dRaw: number[] = new Array(close.length).fill(NaN);
  for (let i = kPeriod - 1 + dPeriod - 1; i < close.length; i++) {
    dRaw[i] = (kRaw[i] + kRaw[i - 1] + kRaw[i - 2]) / 3;
  }
  return { k, d: nanToNull(dRaw) };
}

/** Average Directional Index (14). */
export function adx(high: number[], low: number[], close: number[], period = 14): Num[] {
  const n = close.length;
  const out: Num[] = new Array(n).fill(null);
  if (n <= period * 2) return out;
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  const tr: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
  }
  let atrSum = 0;
  for (let i = 1; i <= period; i++) atrSum += tr[i];
  let plusSum = 0;
  let minusSum = 0;
  for (let i = 1; i <= period; i++) {
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }
  let atrVal = atrSum / period;
  let plusVal = plusSum / period;
  let minusVal = minusSum / period;
  let prevDX = 0;
  let sumDX = 0;
  for (let i = period + 1; i < n; i++) {
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
    plusVal = (plusVal * (period - 1) + plusDM[i]) / period;
    minusVal = (minusVal * (period - 1) + minusDM[i]) / period;
    const dx = atrVal === 0 ? 0 : (Math.abs(plusVal - minusVal) / atrVal) * 100;
    if (i <= period * 2 - 1) {
      sumDX += dx;
      if (i === period * 2 - 1) {
        out[i] = sumDX / period;
        prevDX = out[i]!;
      }
    } else {
      prevDX = (prevDX * (period - 1) + dx) / period;
      out[i] = prevDX;
    }
  }
  return out;
}

export function stdev(values: number[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

export function rateOfChange(values: number[], period = 1): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  for (let i = period; i < values.length; i++) {
    out[i] = values[i - period] === 0 ? null : ((values[i] - values[i - period]) / values[i - period]) * 100;
  }
  return out;
}

/** On-Balance Volume series. */
export function obv(close: number[], volume: number[]): number[] {
  const out: number[] = new Array(close.length).fill(0);
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i - 1]) out[i] = out[i - 1] + volume[i];
    else if (close[i] < close[i - 1]) out[i] = out[i - 1] - volume[i];
    else out[i] = out[i - 1];
  }
  return out;
}

/** Linear slope of the last `window` points normalized by their scale. */
export function lastSlope(values: number[], window: number): number | null {
  if (values.length < window) return null;
  const slice = values.slice(values.length - window);
  const n = slice.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const mean = sumY / n;
  return mean === 0 ? null : slope / Math.abs(mean);
}