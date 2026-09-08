"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAnalysisResult } from "@/lib/analysis";
import { ASSETS, normalizeSymbol, REFRESH_MS, TIMEFRAMES } from "@/lib/config";
import { fetchAllTimeframes } from "@/lib/market";
import type { AnalysisResult, Candle } from "@/lib/types";

/** Which user gesture triggered the fetch that is currently in flight. */
export type MarketAction = "initial" | "symbol" | "interval" | "demo" | "refresh";

/**
 * Floor for how long a user-triggered loader stays on screen. Server-cached
 * responses can come back in a few milliseconds; without a floor the spinner
 * flashes for one frame and the interaction reads as "nothing happened".
 */
export const MIN_LOADER_MS = 550;

export const ACTION_LABEL: Record<MarketAction, string> = {
  initial: "Loading market data…",
  symbol: "Loading pair…",
  interval: "Switching timeframe…",
  demo: "Switching data source…",
  refresh: "Refreshing market data…",
};

export interface MarketState {
  status: "idle" | "loading" | "ready" | "error";
  analysis: AnalysisResult | null;
  error: string | null;
  warnings: string[];
  simulated: boolean;
  /** Background auto-refresh in flight (does not block the UI). */
  refreshing: boolean;
  loading: boolean;
  /** The user action currently in flight, or null when idle. */
  pending: MarketAction | null;
  /** True while a user action is in flight — drives the visible loaders. */
  busy: boolean;
  /** Human label for the in-flight action. */
  busyLabel: string;
  /** Epoch ms of the last successful load. */
  lastUpdatedAt: number | null;
  reload: () => void;
  symbol: string;
  interval: string;
  demo: boolean;
  setSymbol: (s: string) => void;
  setInterval: (i: string) => void;
  setDemo: (d: boolean) => void;
  /** Raw candles for the currently selected interval + symbol. */
  candles: Candle[];
}

interface MarketRequest {
  symbol: string;
  interval: string;
  demo: boolean;
  /** Bumped on every user action so repeating the same choice still reloads. */
  nonce: number;
  action: MarketAction;
}

export function useMarketData(initialSymbol: string, initialInterval: string): MarketState {
  const [request, setRequest] = useState<MarketRequest>({
    symbol: normalizeSymbol(initialSymbol),
    interval: initialInterval,
    demo: false,
    nonce: 0,
    action: "initial",
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rawCandles, setRawCandles] = useState<Record<string, Candle[]>>({});
  const [status, setStatus] = useState<MarketState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [simulated, setSimulated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<MarketAction | null>("initial");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /** Monotonic request id: only the newest response is allowed to write state. */
  const seqRef = useRef(0);
  const hasDataRef = useRef(false);
  const pendingRef = useRef(true);

  const load = useCallback(async (req: MarketRequest, keepPrevious: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;
    if (!keepPrevious) {
      setStatus("loading");
      setError(null);
    }
    try {
      const all = await fetchAllTimeframes(req.symbol, { demo: req.demo, signal: controller.signal });
      if (seq !== seqRef.current) return; // superseded by a newer request
      if (Object.keys(all.candlesByInterval).length === 0) {
        // Every timeframe failed — surface it instead of rendering an empty,
        // zero-priced dashboard.
        throw new Error(all.warnings[0] ?? "Market data unavailable.");
      }
      const name = ASSETS.find((a) => a.symbol === req.symbol)?.name ?? req.symbol;
      const result = buildAnalysisResult(
        req.symbol,
        name,
        req.interval,
        all.candlesByInterval,
        TIMEFRAMES,
        all.asOf,
        all.fetchedAt,
        all.simulated ? "simulated" : "binance",
      );
      setRawCandles(all.candlesByInterval);
      setWarnings(all.warnings);
      setSimulated(all.simulated || req.demo);
      setAnalysis(result);
      setStatus("ready");
      setError(null);
      setLastUpdatedAt(Date.now());
      hasDataRef.current = true;
    } catch (err) {
      if (seq !== seqRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load market data.");
    }
  }, []);

  // Every request change (including a repeated action) runs one load, and the
  // loader it drives is held for at least MIN_LOADER_MS.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const startedAt = Date.now();
    pendingRef.current = true;
    setPending(request.action);
    void load(request, hasDataRef.current).finally(() => {
      const remaining = Math.max(0, MIN_LOADER_MS - (Date.now() - startedAt));
      timer = window.setTimeout(() => {
        if (cancelled) return;
        pendingRef.current = false;
        setPending(null);
      }, remaining);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [request, load]);

  // Background auto-refresh. Deliberately does not set `pending`: an unattended
  // timer must not throw a blocking loader over content the user is reading.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pendingRef.current) return; // a user action is already in flight
      setRefreshing(true);
      void load(request, true).finally(() => setRefreshing(false));
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [request, load]);

  // Abort any in-flight request when the hook unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const setSymbol = useCallback((s: string) => {
    const next = normalizeSymbol(s);
    setRequest((r) => ({ ...r, symbol: next, nonce: r.nonce + 1, action: "symbol" }));
  }, []);
  const setIntervalValue = useCallback((i: string) => {
    setRequest((r) => ({ ...r, interval: i, nonce: r.nonce + 1, action: "interval" }));
  }, []);
  const setDemo = useCallback((d: boolean) => {
    setRequest((r) => ({ ...r, demo: d, nonce: r.nonce + 1, action: "demo" }));
  }, []);
  const reload = useCallback(() => {
    setRequest((r) => ({ ...r, nonce: r.nonce + 1, action: "refresh" }));
  }, []);

  return {
    status,
    analysis,
    error,
    warnings,
    simulated,
    refreshing,
    loading: status === "loading",
    pending,
    busy: pending !== null,
    busyLabel: pending ? ACTION_LABEL[pending] : "",
    lastUpdatedAt,
    reload,
    symbol: request.symbol,
    interval: request.interval,
    demo: request.demo,
    setSymbol,
    setInterval: setIntervalValue,
    setDemo,
    candles: rawCandles[request.interval] ?? [],
  };
}
