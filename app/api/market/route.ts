import { NextRequest, NextResponse } from "next/server";
import { generateDemoCandles } from "@/lib/demo";
import type { Candle, MarketData, MarketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// const BINANCE = "https://api.binance.com/api/v3/klines";
const BINANCE = "https://trade.lcgonlinesystems.com/market.php";
const ALLOWED_INTERVALS = new Set(["15m", "1h", "4h", "1d"]);
const MAX_LIMIT = 500;
const CACHE_TTL_MS = 30_000; // upstream candles change slowly; this also protects rate limits
const FETCH_TIMEOUT_MS = 8000;

interface CacheEntry {
  data: MarketData;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<MarketData>>();

function parseKline(row: unknown[]): Candle | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const [time, open, high, low, close, volume] = row;
  const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v)));
  const t = num(time);
  const o = num(open);
  const h = num(high);
  const l = num(low);
  const c = num(close);
  const v = num(volume);
  if (![t, o, h, l, c, v].every(Number.isFinite) || h < l) return null;
  return { time: t, open: o, high: h, low: l, close: c, volume: v };
}

async function fetchBinance(symbol: string, interval: string, limit: number): Promise<MarketData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BINANCE}?symbol=${symbol}&interval=${interval}&limit=${limit}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429 || res.status === 418) {
    throw new Error("Data provider rate limit reached — retry shortly.");
  }
  if (res.status === 400 || res.status === 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Unavailable symbol or interval (${res.status}).${body ? ` ${body}` : ""}`);
  }
  if (!res.ok) {
    throw new Error(`Data provider error (${res.status}).`);
  }
  const rows: unknown[][] = await res.json();
  const candles: Candle[] = [];
  for (const row of rows) {
    const c = parseKline(row);
    if (c && (candles.length === 0 || c.time > candles[candles.length - 1].time)) candles.push(c);
  }
  if (candles.length < 30) {
    throw new Error("Provider returned insufficient candle history.");
  }
  const asOf = candles[candles.length - 1].time;
  const now = Date.now();
  const age = now - (asOf + intervalMs(interval));
  const status: MarketStatus = age > 3 * intervalMs(interval) ? "stale" : "ok";
  return {
    symbol,
    interval,
    candles,
    asOf,
    fetchedAt: now,
    source: "binance",
    status,
    simulated: false,
    caveat:
      status === "stale"
        ? "The latest candles appear older than expected — data may be delayed."
        : undefined,
  };
}

function intervalMs(interval: string): number {
  switch (interval) {
    case "15m":
      return 15 * 60_000;
    case "1h":
      return 60 * 60_000;
    case "4h":
      return 4 * 60 * 60_000;
    case "1d":
      return 24 * 60 * 60_000;
    default:
      return 60 * 60_000;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  const interval = searchParams.get("interval") || "1h";
  const demo = searchParams.get("demo") === "1";
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(MAX_LIMIT, Math.max(100, parseInt(limitRaw || "320", 10) || 320));

  if (!/^[A-Z0-9]{3,20}$/.test(symbol)) {
    return NextResponse.json({ ok: false, error: "Invalid symbol." }, { status: 400 });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ ok: false, error: "Unsupported interval." }, { status: 400 });
  }

  if (demo) {
    const data: MarketData = {
      symbol,
      interval,
      candles: generateDemoCandles(symbol, interval, limit),
      asOf: Date.now(),
      fetchedAt: Date.now(),
      source: "simulated",
      status: "ok",
      simulated: true,
      caveat: "Showing DEMO data (synthetically generated). It is not live market data and must not be used for decisions.",
    };
    return NextResponse.json({ ok: true, data, servedFromCache: false });
  }

  const key = `${symbol}:${interval}:${limit}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, data: cached.data, servedFromCache: true });
  }

  // Deduplicate concurrent identical requests.
  let promise = inflight.get(key);
  if (!promise) {
    promise = fetchBinance(symbol, interval, limit)
      .then((data) => {
        cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }

  try {
    const data = await promise;
    return NextResponse.json({ ok: true, data, servedFromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Market data unavailable.";
    // Serve a stale cache entry if we have one to keep the UI usable.
    const stale = cache.get(key);
    if (stale) {
      return NextResponse.json({
        ok: true,
        data: { ...stale.data, status: "stale", caveat: "Showing cached data — live feed unreachable." },
        servedFromCache: true,
        warning: message,
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}