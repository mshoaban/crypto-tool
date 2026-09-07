// Client-side market data fetching against our own route handler.

import { TIMEFRAMES } from "./config";
import type { Candle, MarketData } from "./types";

export interface MarketResponse {
  ok: boolean;
  data?: MarketData;
  servedFromCache?: boolean;
  warning?: string;
  error?: string;
}

export async function fetchMarket(symbol: string, interval: string, opts?: { demo?: boolean; signal?: AbortSignal }): Promise<MarketResponse> {
  const params = new URLSearchParams({ symbol, interval, limit: "360" });
  if (opts?.demo) params.set("demo", "1");
  try {
    const res = await fetch(`/api/market?${params.toString()}`, {
      signal: opts?.signal,
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as MarketResponse;
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `Request failed (${res.status}).` };
    }
    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: "Network error reaching the market feed." };
  }
}

export interface AllTimeframes {
  candlesByInterval: Record<string, Candle[]>;
  sources: Set<string>;
  asOf: number;
  fetchedAt: number;
  simulated: boolean;
  warnings: string[];
}

/** Fetch all configured timeframes for the analysis dashboard. */
export async function fetchAllTimeframes(
  symbol: string,
  opts?: { demo?: boolean; signal?: AbortSignal },
): Promise<AllTimeframes> {
  const candlesByInterval: Record<string, Candle[]> = {};
  const sources = new Set<string>();
  const warnings: string[] = [];
  let asOf = 0;
  let fetchedAt = Date.now();
  let simulated = false;

  // Fetch sequentially to be gentle with rate limits and the shared cache.
  for (const tf of TIMEFRAMES) {
    const r = await fetchMarket(symbol, tf.interval, opts);
    if (!r.ok || !r.data) {
      warnings.push(`${tf.label}: ${r.error || "unavailable"}`);
      continue;
    }
    candlesByInterval[tf.interval] = r.data.candles;
    sources.add(r.data.source);
    if (r.data.simulated) simulated = true;
    if (r.warning) warnings.push(`${tf.label}: ${r.warning}`);
    asOf = Math.max(asOf, r.data.asOf);
    fetchedAt = Math.max(fetchedAt, r.data.fetchedAt);
  }
  return { candlesByInterval, sources, asOf, fetchedAt, simulated, warnings };
}