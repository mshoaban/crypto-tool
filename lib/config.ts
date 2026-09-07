// Curated asset and timeframe configuration.

export interface Asset {
  symbol: string; // exchange symbol, e.g. BTCUSDT
  name: string; // display name, e.g. Bitcoin
  short: string; // ticker, e.g. BTC
  color: string; // brand accent
}

export const ASSETS: Asset[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", short: "BTC", color: "#f7931a" },
  { symbol: "ETHUSDT", name: "Ethereum", short: "ETH", color: "#627eea" },
  { symbol: "SOLUSDT", name: "Solana", short: "SOL", color: "#9945ff" },
  { symbol: "BNBUSDT", name: "BNB", short: "BNB", color: "#f0b90b" },
  { symbol: "XRPUSDT", name: "XRP", short: "XRP", color: "#00aae4" },
  { symbol: "ADAUSDT", name: "Cardano", short: "ADA", color: "#0033ad" },
  { symbol: "DOGEUSDT", name: "Dogecoin", short: "DOGE", color: "#c2a633" },
  { symbol: "LINKUSDT", name: "Chainlink", short: "LINK", color: "#2a5ada" },
];

/** Normalize common pair formats before they are sent to the market feed. */
export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[\s/_-]/g, "");
}

export interface TimeframeDef {
  interval: string; // Binance kline interval
  label: string; // short label
  full: string; // human name
  bars: number; // candles to fetch for stable indicators
  /** Weight used when combining timeframes into the overall verdict. */
  weight: number;
}

export const TIMEFRAMES: TimeframeDef[] = [
  { interval: "15m", label: "15m", full: "15 minute", bars: 260, weight: 1 },
  { interval: "1h", label: "1H", full: "1 hour", bars: 320, weight: 1.4 },
  { interval: "4h", label: "4H", full: "4 hour", bars: 320, weight: 1.8 },
  { interval: "1d", label: "1D", full: "Daily", bars: 360, weight: 2.2 },
];

export const DEFAULT_INTERVAL = "1h";
export const DEFAULT_SYMBOL = "BTCUSDT";

export const REFRESH_MS = 60_000; // auto-refresh cadence
export const STALE_MS = 5 * 60_000; // considered stale after this

/** Binance rate-limit budget helpers (background, informational). */
export const BINANCE_WEIGHT_LIMIT = 1200; // per-minute weight bucket
export const KLINES_WEIGHT = 2; // weight of a kline request (20ms*weight units)