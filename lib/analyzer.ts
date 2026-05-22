import { ema, rsi, macd, atr, adx, bbands, stochRsi, sma } from './indicators';

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorRow extends OHLCV {
  EMA9: number; EMA20: number; EMA50: number; EMA200: number;
  RSI: number;
  MACD: number; MACD_signal: number; MACD_hist: number;
  StochK: number; StochD: number;
  ADX: number; DI_plus: number; DI_minus: number;
  ATR: number;
  BB_upper: number; BB_middle: number; BB_lower: number;
  BB_pct: number; BB_width: number;
  Vol_SMA20: number; Vol_ratio: number;
  body_size: number; upper_wick: number; lower_wick: number; candle_range: number;
}

export interface SRLevel { price: number; touches: number; last_date: number; }
export interface TradePlan {
  signal: 'BUY' | 'SELL';
  current_price: number; atr: number;
  entry: number; entry_ideal: number;
  stop_loss: number;
  tp1: number; tp2: number; tp3: number;
  rr1: number; rr2: number; rr3: number;
  risk_per_unit: number; risk_pct_price: number;
  account_size: number; risk_amount: number;
  position_size_units: number; position_size_usdt: number; position_pct: number;
  expected_value: number;
  nearest_support: number | null; nearest_resistance: number | null;
  tp2_blocked: boolean;
  tp2_resistance_warning?: number;
  tp2_support_warning?: number;
}

export interface ScoreDetail {
  EMA?: string; MACD?: string; RSI?: string; StochRSI?: string;
  DI?: string; Volume?: string; BB?: string; ADX_weight?: string;
  SR_notes: string[];
}

export interface TimeframeResult {
  tf: string;
  raw_score: number;
  adj_score: number;
  detail: ScoreDetail;
  supports: SRLevel[];
  resistances: SRLevel[];
  last: IndicatorRow;
  patterns: [string, string, number][];
  market_structure: string;
}

export interface AnalysisResult {
  symbol: string;
  timestamp: number;
  price: number;
  timeframes: TimeframeResult[];
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  grade: string;
  grade_text: string;
  plan: TradePlan | null;
  adj_scores: Record<string, number>;
  raw_scores: Record<string, number>;
  bias: string;
  ema200: number;
  atr_4h: number;
  adx_4h: number;
  vol_ratio_4h: number;
  struct_4h: string;
}

// ── Helpers ──────────────────────────────────────────────
export function getDecimals(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 1) return 4;
  if (price >= 0.01) return 6;
  return 8;
}
export function fmtPrice(price: number): string {
  return price.toFixed(getDecimals(price));
}
function round(v: number, d: number) { return Math.round(v * 10 ** d) / 10 ** d; }

// ── Add indicators ────────────────────────────────────────
export function addIndicators(bars: OHLCV[]): IndicatorRow[] {
  const c = bars.map(b => b.close);
  const h = bars.map(b => b.high);
  const l = bars.map(b => b.low);
  const v = bars.map(b => b.volume);

  const e9 = ema(c, 9), e20 = ema(c, 20), e50 = ema(c, 50), e200 = ema(c, 200);
  const rsiV = rsi(c, 14);
  const { macd: macdV, signal: macdSig, hist: macdHist } = macd(c);
  const { k: sk, d: sd } = stochRsi(c, 14, 14, 3, 3);
  const { adx: adxV, diPlus, diMinus } = adx(h, l, c, 14);
  const atrV = atr(h, l, c, 14);
  const { upper: bbU, middle: bbM, lower: bbL } = bbands(c, 20, 2);
  const vol20 = sma(v, 20);

  return bars.map((b, i) => {
    const bodySize = Math.abs(b.close - b.open);
    const upperWick = b.high - Math.max(b.close, b.open);
    const lowerWick = Math.min(b.close, b.open) - b.low;
    const candleRange = b.high - b.low;
    const bbPct = (bbU[i] - bbL[i]) === 0 ? 0.5 : (b.close - bbL[i]) / (bbU[i] - bbL[i]);
    return {
      ...b,
      EMA9: e9[i], EMA20: e20[i], EMA50: e50[i], EMA200: e200[i],
      RSI: rsiV[i],
      MACD: macdV[i], MACD_signal: macdSig[i], MACD_hist: macdHist[i],
      StochK: sk[i], StochD: sd[i],
      ADX: adxV[i], DI_plus: diPlus[i], DI_minus: diMinus[i],
      ATR: atrV[i],
      BB_upper: bbU[i], BB_middle: bbM[i], BB_lower: bbL[i],
      BB_pct: bbPct, BB_width: candleRange > 0 ? (bbU[i] - bbL[i]) / b.close : NaN,
      Vol_SMA20: vol20[i], Vol_ratio: vol20[i] > 0 ? b.volume / vol20[i] : NaN,
      body_size: bodySize, upper_wick: upperWick, lower_wick: lowerWick, candle_range: candleRange,
    };
  });
}

// ── S/R ───────────────────────────────────────────────────
function findPivots(rows: IndicatorRow[], left = 5, right = 5) {
  const highs: [number, number][] = [], lows: [number, number][] = [];
  for (let i = left; i < rows.length - right; i++) {
    const wH = rows.slice(i - left, i + right + 1).map(r => r.high);
    const wL = rows.slice(i - left, i + right + 1).map(r => r.low);
    if (rows[i].high === Math.max(...wH)) highs.push([rows[i].timestamp, rows[i].high]);
    if (rows[i].low === Math.min(...wL)) lows.push([rows[i].timestamp, rows[i].low]);
  }
  return { highs, lows };
}

function clusterLevels(levels: [number, number][], tolPct = 0.6): SRLevel[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a[1] - b[1]);
  const clusters: SRLevel[] = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const mean = cur.reduce((s, [, p]) => s + p, 0) / cur.length;
    if (Math.abs(sorted[i][1] - mean) / mean * 100 <= tolPct) {
      cur.push(sorted[i]);
    } else {
      const prices = cur.map(([, p]) => p);
      clusters.push({
        price: round(prices.reduce((a, b) => a + b, 0) / prices.length, 8),
        touches: cur.length,
        last_date: Math.max(...cur.map(([d]) => d)),
      });
      cur = [sorted[i]];
    }
  }
  const prices = cur.map(([, p]) => p);
  clusters.push({
    price: round(prices.reduce((a, b) => a + b, 0) / prices.length, 8),
    touches: cur.length,
    last_date: Math.max(...cur.map(([d]) => d)),
  });
  return clusters;
}

export function getSRLevels(rows: IndicatorRow[], n = 6): {
  supports: SRLevel[], resistances: SRLevel[], allSup: number[], allRes: number[]
} {
  const { highs, lows } = findPivots(rows, 5, 5);
  const resClusters = clusterLevels(highs);
  const supClusters = clusterLevels(lows);
  const price = rows[rows.length - 1].close;
  const supports = resClusters.filter(c => c.price < price)
    .sort((a, b) => b.price - a.price).slice(0, n);
  const resistances = supClusters.filter(c => c.price > price)
    .sort((a, b) => a.price - b.price).slice(0, n);
  // swap — pivot highs = resistance, pivot lows = support
  const supsFinal = clusterLevels(lows).filter(c => c.price < price).sort((a, b) => b.price - a.price).slice(0, n);
  const resFinal = clusterLevels(highs).filter(c => c.price > price).sort((a, b) => a.price - b.price).slice(0, n);
  return {
    supports: supsFinal,
    resistances: resFinal,
    allSup: clusterLevels(lows).map(c => c.price),
    allRes: clusterLevels(highs).map(c => c.price),
  };
}

function findBreakout(price: number, allRes: number[], allSup: number[], atrV: number) {
  const brokenRes = allRes.filter(r => price > r && (price - r) <= 1.2 * atrV);
  const brokenSup = allSup.filter(s => price < s && (s - price) <= 1.2 * atrV);
  if (brokenRes.length) return { type: 'breakout_up', level: Math.max(...brokenRes) };
  if (brokenSup.length) return { type: 'breakdown_down', level: Math.min(...brokenSup) };
  return null;
}

// ── Candle patterns ───────────────────────────────────────
export function detectPatterns(rows: IndicatorRow[]): [string, string, number][] {
  const patterns: [string, string, number][] = [];
  if (rows.length < 3) return patterns;
  const [c1, c2, c3] = [rows[rows.length - 3], rows[rows.length - 2], rows[rows.length - 1]];

  if (c2.close < c2.open && c3.close > c3.open && c3.open < c2.close && c3.close > c2.open)
    patterns.push(['BULLISH ENGULFING', 'bullish', 2]);
  if (c2.close > c2.open && c3.close < c3.open && c3.open > c2.close && c3.close < c2.open)
    patterns.push(['BEARISH ENGULFING', 'bearish', 2]);

  const rng = c3.candle_range;
  if (rng > 0) {
    if (c3.lower_wick >= 2 * c3.body_size && c3.upper_wick <= 0.3 * rng && c3.body_size >= 0.1 * rng)
      patterns.push(['HAMMER', 'bullish', 1]);
    if (c3.upper_wick >= 2 * c3.body_size && c3.lower_wick <= 0.3 * rng && c3.body_size >= 0.1 * rng)
      patterns.push(['SHOOTING STAR', 'bearish', 1]);
    if (c3.body_size / c3.candle_range < 0.1)
      patterns.push(['DOJI', 'neutral', 0]);
  }

  if (c1.close < c1.open &&
    Math.abs(c2.close - c2.open) < 0.3 * Math.abs(c1.close - c1.open) &&
    c3.close > c3.open && c3.close > (c1.open + c1.close) / 2)
    patterns.push(['MORNING STAR', 'bullish', 3]);

  if (c1.close > c1.open &&
    Math.abs(c2.close - c2.open) < 0.3 * Math.abs(c1.close - c1.open) &&
    c3.close < c3.open && c3.close < (c1.open + c1.close) / 2)
    patterns.push(['EVENING STAR', 'bearish', 3]);

  return patterns;
}

// ── Market structure ──────────────────────────────────────
export function analyzeMarketStructure(rows: IndicatorRow[]): string {
  const { highs, lows } = findPivots(rows, 4, 4);
  if (highs.length < 3 || lows.length < 3) return 'UNKNOWN';
  const rH = highs.slice(-4).map(([, p]) => p);
  const rL = lows.slice(-4).map(([, p]) => p);
  const hh = rH.every((v, i) => i === 0 || v > rH[i - 1]);
  const hl = rL.every((v, i) => i === 0 || v > rL[i - 1]);
  const lh = rH.every((v, i) => i === 0 || v < rH[i - 1]);
  const ll = rL.every((v, i) => i === 0 || v < rL[i - 1]);
  if (hh && hl) return 'UPTREND (HH/HL)';
  if (lh && ll) return 'DOWNTREND (LH/LL)';
  return 'RANGING / CONSOLIDATION';
}

// ── Score ─────────────────────────────────────────────────
export function scoreTimeframe(
  rows: IndicatorRow[],
  supports: SRLevel[],
  resistances: SRLevel[],
  allSup: number[],
  allRes: number[]
): { raw: number; adj: number; detail: ScoreDetail; srAdj: number } {
  const last = rows[rows.length - 1];
  const price = last.close;
  const atrV = last.ATR;
  let score = 0;
  const detail: ScoreDetail = { SR_notes: [] };

  // EMA
  if (last.EMA20 > last.EMA50 && last.close > last.EMA20) {
    score += 1; detail.EMA = '+1 (price > EMA20 > EMA50)';
  } else if (last.EMA20 < last.EMA50 && last.close < last.EMA20) {
    score -= 1; detail.EMA = '-1 (price < EMA20 < EMA50)';
  } else detail.EMA = '0 (mixed)';

  // MACD
  if (last.MACD > last.MACD_signal && last.MACD_hist > 0) {
    score += 1; detail.MACD = '+1 (bullish crossover + positive hist)';
  } else if (last.MACD < last.MACD_signal && last.MACD_hist < 0) {
    score -= 1; detail.MACD = '-1 (bearish crossover + negative hist)';
  } else detail.MACD = '0 (flat/crossing)';

  // RSI
  const rsiV = last.RSI;
  if (rsiV >= 55 && rsiV <= 75) { score += 1; detail.RSI = `+1 (bullish zone: ${rsiV.toFixed(1)})`; }
  else if (rsiV >= 25 && rsiV <= 45) { score -= 1; detail.RSI = `-1 (bearish zone: ${rsiV.toFixed(1)})`; }
  else if (rsiV > 75) { score += 0.5; detail.RSI = `+0.5 (overbought ${rsiV.toFixed(1)})`; }
  else if (rsiV < 25) { score -= 0.5; detail.RSI = `-0.5 (oversold ${rsiV.toFixed(1)})`; }
  else detail.RSI = `0 (neutral ${rsiV.toFixed(1)})`;

  // StochRSI
  if (!isNaN(last.StochK) && !isNaN(last.StochD)) {
    if (last.StochK > last.StochD && last.StochK < 80) { score += 1; detail.StochRSI = `+1 (K>${last.StochD.toFixed(0)}, not overbought)`; }
    else if (last.StochK < last.StochD && last.StochK > 20) { score -= 1; detail.StochRSI = `-1 (K<${last.StochD.toFixed(0)}, not oversold)`; }
    else detail.StochRSI = '0 (extreme zone or flat)';
  } else detail.StochRSI = 'N/A';

  // DI
  if (!isNaN(last.DI_plus) && !isNaN(last.DI_minus)) {
    if (last.DI_plus > last.DI_minus) { score += 1; detail.DI = `+1 (DI+ ${last.DI_plus.toFixed(1)} > DI- ${last.DI_minus.toFixed(1)})`; }
    else { score -= 1; detail.DI = `-1 (DI- ${last.DI_minus.toFixed(1)} > DI+ ${last.DI_plus.toFixed(1)})`; }
  }

  // Volume
  const vr = isNaN(last.Vol_ratio) ? 1 : last.Vol_ratio;
  if (vr >= 1.5) { score += 0.5; detail.Volume = `+0.5 (strong volume ${vr.toFixed(1)}×)`; }
  else if (vr < 0.7) { score -= 0.5; detail.Volume = `-0.5 (weak volume ${vr.toFixed(1)}×)`; }
  else detail.Volume = `0 (normal volume ${vr.toFixed(1)}×)`;

  // BB
  if (!isNaN(last.BB_pct)) {
    const bp = last.BB_pct;
    if (bp > 0.5 && bp < 0.85) { score += 0.5; detail.BB = `+0.5 (upper-mid range ${(bp * 100).toFixed(0)}%)`; }
    else if (bp > 0.15 && bp <= 0.5) { score -= 0.5; detail.BB = `-0.5 (lower-mid range ${(bp * 100).toFixed(0)}%)`; }
    else detail.BB = `0 (${bp >= 0.85 ? 'near upper' : 'near lower'} band ${(bp * 100).toFixed(0)}%)`;
  }

  const raw = score;

  // ADX weight
  const adxV = last.ADX;
  if (!isNaN(adxV)) {
    if (adxV < 15) { score *= 0.3; detail.ADX_weight = `×0.3 (very weak trend ${adxV.toFixed(1)})`; }
    else if (adxV < 20) { score *= 0.5; detail.ADX_weight = `×0.5 (weak trend ${adxV.toFixed(1)})`; }
    else if (adxV >= 30) { score *= 1.2; detail.ADX_weight = `×1.2 (strong trend ${adxV.toFixed(1)})`; }
    else detail.ADX_weight = `×1.0 (moderate trend ${adxV.toFixed(1)})`;
  }

  // S/R adjustments
  let srAdj = 0;
  const direction = score > 0 ? 'BUY' : 'SELL';

  if (direction === 'BUY' && resistances.length) {
    const nr = resistances[0].price;
    const dist = nr - price;
    if (dist > 0 && dist <= 0.5 * atrV) { srAdj -= 2; detail.SR_notes.push(`⚠ DANGER: ${(dist / price * 100).toFixed(2)}% from R1 (${fmtPrice(nr)}) [-2]`); }
    else if (dist > 0 && dist <= atrV) { srAdj -= 1; detail.SR_notes.push(`⚠ CAUTION: ${(dist / price * 100).toFixed(2)}% from R1 (${fmtPrice(nr)}) [-1]`); }
  }
  if (direction === 'BUY' && supports.length) {
    const ns = supports[0].price;
    const dist = price - ns;
    if (dist > 0 && dist <= 0.5 * atrV) { srAdj += 0.5; detail.SR_notes.push(`✓ On support ${fmtPrice(ns)} (+0.5)`); }
  }
  if (direction === 'SELL' && supports.length) {
    const ns = supports[0].price;
    const dist = price - ns;
    if (dist > 0 && dist <= 0.5 * atrV) { srAdj -= 2; detail.SR_notes.push(`⚠ DANGER: ${(dist / price * 100).toFixed(2)}% from S1 (${fmtPrice(ns)}) [-2]`); }
    else if (dist > 0 && dist <= atrV) { srAdj -= 1; detail.SR_notes.push(`⚠ CAUTION: ${(dist / price * 100).toFixed(2)}% from S1 (${fmtPrice(ns)}) [-1]`); }
  }

  const bo = findBreakout(price, allRes, allSup, atrV);
  if (bo?.type === 'breakout_up' && direction === 'BUY') {
    srAdj += 1.5; detail.SR_notes.push(`✓ BREAKOUT above ${fmtPrice(bo.level)} (+1.5)`);
  } else if (bo?.type === 'breakdown_down' && direction === 'SELL') {
    srAdj += 1.5; detail.SR_notes.push(`✓ BREAKDOWN below ${fmtPrice(bo.level)} (+1.5)`);
  }

  return { raw: round(raw, 2), adj: round(score + srAdj, 2), detail, srAdj };
}

// ── Trade plan ────────────────────────────────────────────
export function calculateTradePlan(
  rows: IndicatorRow[], supports: SRLevel[], resistances: SRLevel[],
  signal: 'BUY' | 'SELL', accountSize = 1000, riskPct = 1, rrRatio = 2
): TradePlan | null {
  const last = rows[rows.length - 1];
  const price = last.close;
  const atrV = last.ATR;
  const dec = getDecimals(price);
  const r = (v: number) => round(v, dec);

  if (signal === 'BUY') {
    const entry = r(price);
    const entryIdeal = r(price - 0.3 * atrV);
    let sl = supports.length ? r(supports[0].price - 0.3 * atrV) : r(price - 1.5 * atrV);
    if ((entry - sl) > 3 * atrV) sl = r(entry - 2.5 * atrV);
    const risk = entry - sl;
    if (risk <= 0) return null;
    const tp1 = r(entry + risk), tp2 = r(entry + risk * rrRatio), tp3 = r(entry + risk * 3);
    let tp2Blocked = false; let tp2ResWarn: number | undefined;
    for (const res of resistances.slice(0, 3)) {
      if (entry < res.price && res.price < tp2) { tp2Blocked = true; tp2ResWarn = res.price; break; }
    }
    const riskAmt = accountSize * (riskPct / 100);
    const units = riskAmt / risk;
    const usdt = units * entry;
    const ev = (0.55 * (tp2 - entry) - 0.45 * risk) / risk;
    return {
      signal, current_price: price, atr: atrV,
      entry, entry_ideal: entryIdeal, stop_loss: sl,
      tp1, tp2, tp3,
      rr1: round(Math.abs(tp1 - entry) / risk, 2),
      rr2: round(Math.abs(tp2 - entry) / risk, 2),
      rr3: round(Math.abs(tp3 - entry) / risk, 2),
      risk_per_unit: round(risk, dec), risk_pct_price: round(risk / entry * 100, 2),
      account_size: accountSize, risk_amount: round(riskAmt, 2),
      position_size_units: round(units, 4), position_size_usdt: round(usdt, 2),
      position_pct: round(usdt / accountSize * 100, 1),
      expected_value: round(ev, 3),
      nearest_support: supports[0]?.price ?? null,
      nearest_resistance: resistances[0]?.price ?? null,
      tp2_blocked: tp2Blocked, tp2_resistance_warning: tp2ResWarn,
    };
  } else {
    const entry = r(price);
    const entryIdeal = r(price + 0.3 * atrV);
    let sl = resistances.length ? r(resistances[0].price + 0.3 * atrV) : r(price + 1.5 * atrV);
    if ((sl - entry) > 3 * atrV) sl = r(entry + 2.5 * atrV);
    const risk = sl - entry;
    if (risk <= 0) return null;
    const tp1 = r(entry - risk), tp2 = r(entry - risk * rrRatio), tp3 = r(entry - risk * 3);
    let tp2Blocked = false; let tp2SupWarn: number | undefined;
    for (const sup of supports.slice(0, 3)) {
      if (tp2 < sup.price && sup.price < entry) { tp2Blocked = true; tp2SupWarn = sup.price; break; }
    }
    const riskAmt = accountSize * (riskPct / 100);
    const units = riskAmt / risk;
    const usdt = units * entry;
    const ev = (0.55 * (entry - tp2) - 0.45 * risk) / risk;
    return {
      signal, current_price: price, atr: atrV,
      entry, entry_ideal: entryIdeal, stop_loss: sl,
      tp1, tp2, tp3,
      rr1: round(Math.abs(tp1 - entry) / risk, 2),
      rr2: round(Math.abs(tp2 - entry) / risk, 2),
      rr3: round(Math.abs(tp3 - entry) / risk, 2),
      risk_per_unit: round(risk, dec), risk_pct_price: round(risk / entry * 100, 2),
      account_size: accountSize, risk_amount: round(riskAmt, 2),
      position_size_units: round(units, 4), position_size_usdt: round(usdt, 2),
      position_pct: round(usdt / accountSize * 100, 1),
      expected_value: round(ev, 3),
      nearest_support: supports[0]?.price ?? null,
      nearest_resistance: resistances[0]?.price ?? null,
      tp2_blocked: tp2Blocked, tp2_support_warning: tp2SupWarn,
    };
  }
}

// ── Grade ─────────────────────────────────────────────────
export function gradeSignal(adjScores: Record<string, number>, signal: string, plan: TradePlan | null) {
  if (signal === 'NEUTRAL') return { grade: 'NEUTRAL', text: 'No actionable signal at this time.' };
  const vals = Object.values(adjScores);
  const total = vals.reduce((a, b) => a + b, 0);
  const allAgree = vals.every(s => s > 0) || vals.every(s => s < 0);
  const tp2Blocked = plan?.tp2_blocked ?? false;
  const rr = plan?.rr2 ?? 0;

  if (allAgree && Math.abs(total) >= 7 && !tp2Blocked && rr >= 1.8)
    return { grade: 'A', text: '★★★ High-confidence setup. All timeframes aligned, clear S/R structure, good RR.' };
  if (allAgree && Math.abs(total) >= 5 && rr >= 1.5)
    return { grade: 'B', text: '★★  Solid setup. Good alignment, acceptable risk/reward.' };
  if (Math.abs(total) >= 3)
    return { grade: 'C', text: '★   Weak setup. Trade with reduced size or wait for better entry.' };
  return { grade: 'D', text: '✗   Poor setup. Not recommended — conflicting signals.' };
}
