"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAnalysisResult } from "@/lib/analysis";
import { ASSETS, normalizeSymbol, REFRESH_MS, TIMEFRAMES } from "@/lib/config";
import { fetchAllTimeframes } from "@/lib/market";
import type { AnalysisResult, Candle } from "@/lib/types";

export interface MarketState {
  status: "idle" | "loading" | "ready" | "error";
  analysis: AnalysisResult | null;
  error: string | null;
  warnings: string[];
  simulated: boolean;
  refreshing: boolean;
  loading: boolean;
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

export function useMarketData(initialSymbol: string, initialInterval: string): MarketState {
  const [symbol, setSymbolState] = useState(initialSymbol);
  const [interval, setIntervalState] = useState(initialInterval);
  const [demo, setDemoState] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rawCandles, setRawCandles] = useState<Record<string, Candle[]>>({});
  const [status, setStatus] = useState<MarketState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [simulated, setSimulated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const latestKey = useRef<string>("");

  const load = useCallback(
    async (sym: string, iv: string, useDemo: boolean, isRefresh: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const key = `${sym}:${iv}:${useDemo}`;
      latestKey.current = key;
      if (!isRefresh) {
        setStatus("loading");
        setError(null);
      }
      try {
        const all = await fetchAllTimeframes(sym, { demo: useDemo, signal: controller.signal });
        if (latestKey.current !== key) return; // superseded by a newer request
        setRawCandles(all.candlesByInterval);
        const name = ASSETS.find((a) => a.symbol === sym)?.name ?? sym;
        const result = buildAnalysisResult(
          sym,
          name,
          iv,
          all.candlesByInterval,
          TIMEFRAMES,
          all.asOf,
          all.fetchedAt,
          all.simulated ? "simulated" : "binance",
        );
        setWarnings(all.warnings);
        setSimulated(all.simulated || useDemo);
        setAnalysis(result);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load market data.");
      }
    },
    [],
  );

  const reload = useCallback(() => {
    void load(symbol, interval, demo, false);
  }, [symbol, interval, demo, load]);

  // Initial load + auto-refresh cadence.
  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load(symbol, interval, demo, false);
    }, 0);
    const timer = window.setInterval(() => {
      setRefreshing(true);
      void load(symbol, interval, demo, true).finally(() => setRefreshing(false));
    }, REFRESH_MS);
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [symbol, interval, demo, load]);

  const setSymbol = useCallback((s: string) => setSymbolState(normalizeSymbol(s)), []);
  const setIntervalValue = useCallback((i: string) => setIntervalState(i), []);
  const setDemo = useCallback((d: boolean) => setDemoState(d), []);

  return {
    status,
    analysis,
    error,
    warnings,
    simulated,
    refreshing,
    loading: status === "loading",
    reload,
    symbol,
    interval,
    demo,
    setSymbol,
    setInterval: setIntervalValue,
    setDemo,
    candles: rawCandles[interval] ?? [],
  };
}