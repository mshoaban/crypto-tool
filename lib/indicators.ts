// Pure TS implementations of the technical indicators we need

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(NaN);
  let prev = NaN;
  let smaCount = 0;
  let smaSum = 0;
  for (let i = 0; i < values.length; i++) {
    if (isNaN(values[i])) continue;
    if (isNaN(prev)) {
      smaSum += values[i];
      smaCount++;
      if (smaCount === period) {
        prev = smaSum / period;
        result[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      result[i] = prev;
    }
  }
  return result;
}

export function sma(values: number[], period: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - period + 1), i + 1).filter(v => !isNaN(v));
    return slice.length === period ? slice.reduce((a, b) => a + b, 0) / period : NaN;
  });
}

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = 100 - 100 / (1 + (avgLoss === 0 ? 1e10 : avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = 100 - 100 / (1 + (avgLoss === 0 ? 1e10 : avgGain / avgLoss));
  }
  return result;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => isNaN(v) || isNaN(emaSlow[i]) ? NaN : v - emaSlow[i]);
  
  // Calculate signal on non-NaN macd values then map back
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalSmooth = ema(validMacd, signalPeriod);
  
  const fullSignal: number[] = new Array(closes.length).fill(NaN);
  let si = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      fullSignal[i] = signalSmooth[si] ?? NaN;
      si++;
    }
  }
  const hist = macdLine.map((v, i) => isNaN(v) || isNaN(fullSignal[i]) ? NaN : v - fullSignal[i]);
  return { macd: macdLine, signal: fullSignal, hist };
}

export function atr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr: number[] = [NaN];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = prev;
  for (let i = period + 1; i < closes.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    result[i] = prev;
  }
  return result;
}

export function adx(highs: number[], lows: number[], closes: number[], period = 14) {
  const dmPlus: number[] = [0];
  const dmMinus: number[] = [0];
  const trArr: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trArr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  // Wilder smoothing
  const wilder = (arr: number[], p: number) => {
    const r: number[] = new Array(arr.length).fill(NaN);
    let s = arr.slice(1, p + 1).reduce((a, b) => a + b, 0);
    r[p] = s;
    for (let i = p + 1; i < arr.length; i++) {
      s = s - s / p + arr[i];
      r[i] = s;
    }
    return r;
  };

  const str = wilder(trArr, period);
  const sdmP = wilder(dmPlus, period);
  const sdmM = wilder(dmMinus, period);
  const diP = str.map((v, i) => isNaN(v) || v === 0 ? NaN : (sdmP[i] / v) * 100);
  const diM = str.map((v, i) => isNaN(v) || v === 0 ? NaN : (sdmM[i] / v) * 100);
  const dx = diP.map((v, i) =>
    isNaN(v) || isNaN(diM[i]) || (v + diM[i]) === 0 ? NaN : (Math.abs(v - diM[i]) / (v + diM[i])) * 100
  );

  // ADX is Wilder EMA of DX
  const validDx = dx.filter(v => !isNaN(v));
  const adxSmooth = ema(validDx, period);
  const fullAdx: number[] = new Array(closes.length).fill(NaN);
  let ai = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(dx[i])) { fullAdx[i] = adxSmooth[ai] ?? NaN; ai++; }
  }
  return { adx: fullAdx, diPlus: diP, diMinus: diM };
}

export function bbands(closes: number[], period = 20, stdDev = 2) {
  const mid = sma(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper[i] = mean + stdDev * std;
    lower[i] = mean - stdDev * std;
  }
  return { upper, middle: mid, lower };
}

export function stochRsi(closes: number[], length = 14, rsiLength = 14, kPeriod = 3, dPeriod = 3) {
  const rsiVals = rsi(closes, rsiLength);
  const rawK: number[] = new Array(closes.length).fill(NaN);
  for (let i = length - 1; i < closes.length; i++) {
    const window = rsiVals.slice(i - length + 1, i + 1).filter(v => !isNaN(v));
    if (window.length < length) continue;
    const minR = Math.min(...window), maxR = Math.max(...window);
    rawK[i] = maxR === minR ? 50 : ((rsiVals[i] - minR) / (maxR - minR)) * 100;
  }
  const smoothK = sma(rawK, kPeriod);
  const smoothD = sma(smoothK, dPeriod);
  return { k: smoothK, d: smoothD };
}
