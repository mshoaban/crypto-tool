"use client";

import { useMemo, useState } from "react";
import { ASSETS, normalizeSymbol, TIMEFRAMES } from "@/lib/config";
import { useMarketData } from "@/hooks/useMarketData";
import { buildIndicators } from "@/lib/signals";
import { formatPercent, formatPrice } from "@/lib/format";
import { Badge, Card, Segmented, Spinner, Skeleton } from "./ui";
import Chart from "./Chart";
import PredictionPanel from "./PredictionPanel";
import SignalList from "./SignalList";
import RiskPanel from "./RiskPanel";
import TimeframeTable from "./TimeframeTable";
import { biasMeta } from "./PredictionPanel";

function StatusBar({ refreshing, reload }: { refreshing: boolean; reload: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      {refreshing && (
        <span className="inline-flex items-center gap-1.5">
          <Spinner className="h-3 w-3" /> Refreshing…
        </span>
      )}
      <button
        type="button"
        onClick={reload}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Refresh market data now"
      >
        <span aria-hidden>↻</span> Refresh
      </button>
    </div>
  );
}

function PriceBar({ symbol, name, price, changePct, asOf, fetchedAt, simulated }: {
  symbol: string; name: string; price: number; changePct: number; asOf: number; fetchedAt: number; simulated: boolean;
}) {
  const meta = biasMeta(changePct >= 0 ? "bullish" : "bearish");
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-transparent">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="font-mono text-xs text-muted-foreground">{symbol}</span>
            {simulated && <Badge tone="warn">DEMO DATA</Badge>}
            {!simulated && <Badge tone="neutral">LIVE · Binance</Badge>}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{formatPrice(price)}</span>
            <span className={`text-base font-semibold tabular-nums ${meta.color}`}>{formatPercent(changePct)}</span>
          </div>
        </div>
        <dl className="ml-auto text-right text-xs text-muted-foreground">
          <div>Last bar: {new Date(asOf).toLocaleTimeString()}</div>
          <div>Fetched: {new Date(fetchedAt).toLocaleTimeString()}</div>
          <div>Source: Binance public klines</div>
        </dl>
      </div>
    </Card>
  );
}

function Controls({ symbol, setSymbol, interval, setInterval, demo, setDemo }: {
  symbol: string; setSymbol: (s: string) => void;
  interval: string; setInterval: (i: string) => void;
  demo: boolean; setDemo: (d: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form
        className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const nextSymbol = normalizeSymbol(String(form.get("symbol") ?? ""));
          if (nextSymbol.length >= 3) setSymbol(nextSymbol);
        }}
      >
        <label htmlFor="symbol" className="text-xs font-medium text-muted-foreground">Crypto pair</label>
        <div className="flex gap-2">
          <input
            key={symbol}
            id="symbol"
            name="symbol"
            type="text"
            defaultValue={symbol}
            list="pair-suggestions"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="pair-help"
            placeholder="BTCUSDT or BTC/USDT"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium uppercase text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Analyze
          </button>
        </div>
        <span id="pair-help" className="text-[11px] text-muted-foreground">Any Binance spot pair. Use the exchange symbol, such as BTCUSDT.</span>
        <datalist id="pair-suggestions">
          {ASSETS.map((asset) => <option key={asset.symbol} value={asset.symbol}>{asset.name}</option>)}
        </datalist>
      </form>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Spotlight timeframe</span>
        <Segmented options={TIMEFRAMES.map((t) => ({ value: t.interval, label: t.label }))} value={interval} onChange={setInterval} ariaLabel="Timeframe" />
      </div>

      <label className="flex cursor-pointer items-center gap-2 pt-4">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          className="h-4 w-4 accent-indigo-600"
        />
        <span className="text-xs font-medium text-muted-foreground">Demo (synthetic) data</span>
      </label>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <Card><Skeleton className="h-20 w-full" /></Card>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner /> Loading market data &amp; computing indicators…
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry, onDemo }: { message: string; onRetry: () => void; onDemo: () => void }) {
  return (
    <Card className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-foreground">Market data unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Retry
        </button>
        <button type="button" onClick={onDemo} className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
          Use demo (synthetic) data
        </button>
      </div>
    </Card>
  );
}

function Methodology() {
  return (
    <Card id="methodology" className="scroll-mt-20">
      <h2 className="mb-3 text-base font-semibold text-foreground">Methodology &amp; honesty</h2>
      <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground md:grid-cols-3">
        <div>
          <h3 className="mb-1 font-semibold text-foreground">How signals are computed</h3>
          <p>
            Standard indicators (EMA/SMA trend, MACD, RSI, Stochastic, Bollinger, ATR, OBV, volume) are calculated with
            conventional formulas. Each contributes a weighted, explainable signal; the composite score is a transparent
            heuristic on a −100…+100 scale.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">Confidence is not probability</h3>
          <p>
            Confidence reflects agreement, history and indicator completeness — nothing more. It is never presented as the
            chance of profit. The only performance measure is the separate walk-forward historical hit-rate test.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">No guarantees</h3>
          <p>
            Markets are unpredictable. Past behavior, indicators and backtests never guarantee future results. Treat
            everything as analysis, use sensible risk management, and do not allocate capital you can&apos;t afford to lose.
          </p>
        </div>
      </div>
    </Card>
  );
}

function Disclaimer() {
  return (
    <Card className="border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20">
      <h2 className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">Disclaimer</h2>
      <p className="text-sm leading-relaxed text-amber-800/90 dark:text-amber-200/80">
        This tool provides technical analysis and education only. It is <strong>not financial advice</strong>, does not
        recommend specific trades, and cannot predict outcomes. No profit is guaranteed. Crypto markets are highly
        volatile. Always do your own research and consult a qualified professional before making financial decisions.
      </p>
    </Card>
  );
}

export default function Dashboard() {
  const market = useMarketData("BTCUSDT", "1h");
  const [selected, setSelected] = useState<string>("1h");
  const effectiveInterval = market.analysis?.timeframes.some((t) => t.interval === selected) ? selected : market.interval;
  const tf = market.analysis?.timeframes.find((t) => t.interval === effectiveInterval) ?? null;

  const chartIndicators = useMemo(() => {
    if (!market.candles.length) return null;
    const a = buildIndicators(market.candles);
    return { ema20: a.ema20, ema50: a.ema50, sma50: a.sma50, bbUpper: a.bbUpper, bbLower: a.bbLower, bbMid: a.bbMid };
  }, [market.candles]);

  if (market.status === "loading" && !market.analysis) {
    return <LoadingState />;
  }
  if (market.status === "error" && !market.analysis) {
    return (
      <ErrorState message={market.error ?? "Unknown error"} onRetry={market.reload} onDemo={() => market.setDemo(true)} />
    );
  }
  if (!market.analysis) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Market intelligence workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Read the market before you act.</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Explainable signals, multi-timeframe context and risk levels in one focused view.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${market.simulated ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden />
          {market.simulated ? "Synthetic feed" : "Public market feed"}
        </span>
      </div>
      <Controls
        symbol={market.symbol}
        setSymbol={market.setSymbol}
        interval={market.interval}
        setInterval={market.setInterval}
        demo={market.demo}
        setDemo={market.setDemo}
      />
      <StatusBar refreshing={market.refreshing} reload={market.reload} />

      {market.simulated && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50/50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ You are viewing <strong>synthetic demo data</strong> (live feed unreachable or demo enabled). It is not real
          market data and must not be used for decisions.{" "}
          <button type="button" className="font-semibold underline" onClick={() => market.setDemo(false)}>
            Switch to live
          </button>{" "}
          or retry the live feed.
        </div>
      )}
      {market.warnings.length > 0 && !market.simulated && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50/50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {market.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      <PriceBar
        symbol={market.analysis.symbol}
        name={market.analysis.symbolName}
        price={market.analysis.price}
        changePct={market.analysis.changePct}
        asOf={market.analysis.asOf}
        fetchedAt={market.analysis.fetchedAt}
        simulated={market.analysis.simulated}
      />

      <PredictionPanel analysis={market.analysis} tf={tf} />

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Price chart — {tf?.label ?? effectiveInterval}</h2>
            <p className="text-xs text-muted-foreground">Candles, EMA20/EMA50, Bollinger bands, support/resistance. Hover a bar for details.</p>
          </div>
          <div className="flex gap-4">
            <Legend color="bg-blue-500" label="EMA 20" />
            <Legend color="bg-amber-500" label="EMA 50" />
            <Legend color="bg-purple-400" label="Bollinger" />
          </div>
        </div>
        {chartIndicators ? (
          <Chart candles={market.candles} levels={tf?.levels} {...chartIndicators} />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </Card>

      <TimeframeTable
        timeframes={market.analysis.timeframes}
        selected={effectiveInterval}
        onSelect={(i) => {
          setSelected(i);
          market.setInterval(i);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalList signals={tf?.signals ?? []} />
        <RiskPanel tf={tf} />
      </div>

      <Methodology />
      <Disclaimer />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-3 rounded-sm ${color}`} aria-hidden /> {label}
    </span>
  );
}