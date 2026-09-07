// Synthetic market data generator. Used ONLY as an explicitly-labeled offline /
// demo fallback so the app remains usable when the upstream feed is unreachable.
// Never presented as live data.

import type { Candle } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INTERVAL_MS: Record<string, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const BASE_PRICE: Record<string, number> = {
  BTCUSDT: 64000,
  ETHUSDT: 3300,
  SOLUSDT: 150,
  BNBUSDT: 580,
  XRPUSDT: 0.55,
  ADAUSDT: 0.38,
  DOGEUSDT: 0.14,
  LINKUSDT: 14.5,
};

export function symbolToSeed(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generate `count` synthetic candles ending at the current time. */
export function generateDemoCandles(symbol: string, interval: string, count: number): Candle[] {
  const rng = mulberry32(symbolToSeed(symbol) ^ (INTERVAL_MS[interval] || 3_600_000));
  const step = INTERVAL_MS[interval] || 3_600_000;
  const base = BASE_PRICE[symbol] ?? 100;
  const end = Math.floor(Date.now() / step) * step;
  const candles: Candle[] = [];
  let price = base * (0.7 + rng() * 0.5);
  let trend = 0;
  for (let k = count - 1; k >= 0; k--) {
    const time = end - k * step;
    if (k % 40 === 0) trend = (rng() - 0.5) * 0.006; // regime shift
    const shock = k % 110 === 0 ? (rng() - 0.5) * 0.05 : 0; // occasional volatility spike
    const vol = (BASE_PRICE[symbol] ?? 100) * (0.004 + rng() * 0.004);
    const drift = price * (trend + shock);
    const open = price;
    const close = Math.max(0.00000001, open + drift + (rng() - 0.5) * vol);
    const high = Math.max(open, close) * (1 + rng() * 0.004);
    const low = Math.min(open, close) * (1 - rng() * 0.004);
    const volume = (BASE_PRICE[symbol] ?? 100) * (20 + rng() * 180);
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}