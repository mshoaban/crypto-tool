"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ASSETS, normalizeSymbol, TIMEFRAMES } from "@/lib/config";
import { useMarketData, type MarketAction, type MarketState } from "@/hooks/useMarketData";
import { buildIndicators } from "@/lib/signals";
import { formatDuration, formatPercent, formatPrice } from "@/lib/format";
import {
  Badge,
  BusyOverlay,
  Button,
  Card,
  LiveStatus,
  ScrollRow,
  Segmented,
  Skeleton,
  Spinner,
  TopProgress,
} from "./ui";
import Chart from "./Chart";
import PredictionPanel, { biasMeta } from "./PredictionPanel";
import SignalList from "./SignalList";
import RiskPanel from "./RiskPanel";
import TimeframeTable from "./TimeframeTable";

/** Ticks slowly on its own so the rest of the dashboard doesn't re-render. */
function UpdatedAgo({ at }: { at: number | null }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => bump((v) => v + 1), 5000);
    return () => window.clearInterval(t);
  }, []);
  if (!at) return null;
  return <span className="tabular-nums">Updated {formatDuration(Date.now() - at)}</span>;
}

function Controls({
  symbol,
  setSymbol,
  interval,
  setInterval,
  pending,
  busy,
}: {
  symbol: string;
  setSymbol: (s: string) => void;
  interval: string;
  setInterval: (i: string) => void;
  pending: MarketAction | null;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(symbol);
  useEffect(() => setDraft(symbol), [symbol]);

  return (
    <Card className="relative">
      <div className="grid gap-3.5">
        <form
          className="grid gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const next = normalizeSymbol(draft);
            if (next.length >= 3) setSymbol(next);
          }}
        >
          <label htmlFor="symbol" className="text-xs font-medium text-muted-foreground">
            Crypto pair
          </label>
          <div className="flex gap-2">
            <input
              id="symbol"
              name="symbol"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              list="pair-suggestions"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
              aria-describedby="pair-help"
              placeholder="BTCUSDT or BTC/USDT"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base font-medium uppercase text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 sm:min-h-10 sm:text-sm"
            />
            <Button type="submit" loading={pending === "symbol"} disabled={busy}>
              Analyze
            </Button>
          </div>
          <span id="pair-help" className="text-[11px] text-muted-foreground">
            Any Binance spot pair — use the exchange symbol, such as BTCUSDT.
          </span>
          <datalist id="pair-suggestions">
            {ASSETS.map((asset) => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.name}
              </option>
            ))}
          </datalist>
        </form>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Quick pick</span>
          <ScrollRow>
            <div className="flex w-max items-center gap-1.5 pb-0.5">
              {ASSETS.map((asset) => {
                const active = asset.symbol === symbol;
                return (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => setSymbol(asset.symbol)}
                    disabled={busy}
                    aria-pressed={active}
                    className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-elevated text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: asset.color }} />
                    {asset.short}
                  </button>
                );
              })}
            </div>
          </ScrollRow>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Spotlight timeframe</span>
          <Segmented
            fill
            options={TIMEFRAMES.map((t) => ({ value: t.interval, label: t.label }))}
            value={interval}
            onChange={setInterval}
            pendingValue={pending === "interval" ? interval : null}
            disabled={busy}
            ariaLabel="Timeframe"
          />
        </div>
      </div>
    </Card>
  );
}

function StatusRow({ market }: { market: MarketState }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[11px] text-muted-foreground sm:text-xs">
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${market.simulated ? "bg-amber-500" : "bg-emerald-500"}`}
        />
        {market.simulated ? "Synthetic feed" : "Live public feed"}
        {market.refreshing && (
          <span className="inline-flex items-center gap-1">
            <Spinner className="h-3 w-3" /> syncing
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-2.5">
        <UpdatedAgo at={market.lastUpdatedAt} />
        <Button
          size="sm"
          variant="secondary"
          onClick={market.reload}
          loading={market.pending === "refresh"}
          disabled={market.busy}
        >
          <span aria-hidden>↻</span> Refresh
        </Button>
      </span>
    </div>
  );
}

function PriceBar({
  symbol,
  name,
  price,
  changePct,
  asOf,
  fetchedAt,
  simulated,
}: {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  asOf: number;
  fetchedAt: number;
  simulated: boolean;
}) {
  const meta = biasMeta(changePct >= 0 ? "bullish" : "bearish");
  const rows = [
    ["Last bar", new Date(asOf).toLocaleTimeString()],
    ["Fetched", new Date(fetchedAt).toLocaleTimeString()],
    ["Source", simulated ? "Synthetic generator" : "Binance public klines"],
  ] as const;
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-transparent">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{symbol}</span>
            {simulated ? <Badge tone="warn">DEMO DATA</Badge> : <Badge tone="neutral">LIVE · Binance</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-foreground sm:text-3xl">
              {formatPrice(price)}
            </span>
            <span className={`text-sm font-semibold tabular-nums sm:text-base ${meta.color}`}>
              {formatPercent(changePct)}
            </span>
          </div>
        </div>
        <dl className="grid gap-0.5 text-[11px] text-muted-foreground sm:min-w-[13rem]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 sm:justify-end">
              <dt className="sm:hidden">{label}</dt>
              <dd className="truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 sm:gap-4">
      <Card>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-11 w-full" />
        <Skeleton className="mt-3 h-9 w-full" />
      </Card>
      <Card>
        <Skeleton className="h-16 w-full" />
      </Card>
      <Card>
        <Skeleton className="h-[280px] w-full sm:h-[360px] lg:h-[440px]" />
      </Card>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
      <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status">
        <Spinner /> Loading market data &amp; computing indicators…
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <h2 className="text-base font-semibold text-foreground sm:text-lg">Market data unavailable</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-4">
        <Button onClick={onRetry} loading={retrying} fullWidth>
          Retry live feed
        </Button>
      </div>
    </Card>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-red-400/50 bg-red-50/60 text-red-800 dark:bg-red-950/30 dark:text-red-200"
      : "border-amber-400/50 bg-amber-50/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed sm:text-sm ${styles}`}>{children}</div>
  );
}

function Methodology() {
  return (
    <Card id="methodology" className="scroll-mt-24">
      <h2 className="mb-3 text-sm font-semibold text-foreground sm:text-base">Methodology &amp; honesty</h2>
      <div className="grid gap-4 text-[13px] leading-relaxed text-muted-foreground sm:text-sm md:grid-cols-3">
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
      <p className="text-[13px] leading-relaxed text-amber-800/90 dark:text-amber-200/80 sm:text-sm">
        This tool provides technical analysis and education only. It is <strong>not financial advice</strong>, does not
        recommend specific trades, and cannot predict outcomes. No profit is guaranteed. Crypto markets are highly
        volatile. Always do your own research and consult a qualified professional before making financial decisions.
      </p>
    </Card>
  );
}

export default function Dashboard() {
  const market = useMarketData("BTCUSDT", "1h");
  const tf = market.analysis?.timeframes.find((t) => t.interval === market.interval) ?? market.analysis?.timeframes[0] ?? null;

  const chartIndicators = useMemo(() => {
    if (!market.candles.length) return null;
    const a = buildIndicators(market.candles);
    return { ema20: a.ema20, ema50: a.ema50, sma50: a.sma50, bbUpper: a.bbUpper, bbLower: a.bbLower, bbMid: a.bbMid };
  }, [market.candles]);

  // No analysis yet: either the very first load is running, or it failed
  // outright. (`idle` counts as loading — the fetch starts in an effect.)
  if (!market.analysis) {
    if (market.status === "error") {
      return (
        <>
          <TopProgress active={market.busy} />
          <LiveStatus message={`Market data unavailable. ${market.error ?? ""}`} />
          <ErrorState
            message={market.error ?? "Unknown error"}
            onRetry={market.reload}
            retrying={market.busy}
          />
        </>
      );
    }
    return (
      <>
        <TopProgress active />
        <LiveStatus message="Loading market data" />
        <LoadingState />
      </>
    );
  }

  const analysis = market.analysis;

  return (
    <div className="grid gap-3 sm:gap-4">
      <TopProgress active={market.busy} />
      <LiveStatus message={market.busy ? market.busyLabel : `Analysis updated for ${analysis.symbol}.`} />

      {/* Floating loader: stays in view no matter where the user has scrolled. */}
      {market.busy && (
        <div className="pointer-events-none fixed left-1/2 top-[4.75rem] z-40 -translate-x-1/2 animate-fade-in px-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur">
            <Spinner className="h-3.5 w-3.5 text-primary" />
            {market.busyLabel}
          </span>
        </div>
      )}

      <header className="grid gap-1 border-b border-border pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Market intelligence workspace</p>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          Read the market before you act.
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          Explainable signals, multi-timeframe context and risk levels in one focused view.
        </p>
      </header>

      <Controls
        symbol={market.symbol}
        setSymbol={market.setSymbol}
        interval={market.interval}
        setInterval={market.setInterval}
        pending={market.pending}
        busy={market.busy}
      />
      <StatusRow market={market} />

      {market.status === "error" && (
        <Notice tone="error">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              ⚠{" "}
              {market.symbol === analysis.symbol
                ? `Latest refresh failed: ${market.error} Showing the last successful analysis.`
                : `Couldn't load ${market.symbol}: ${market.error} Still showing ${analysis.symbol}.`}
            </span>
            <Button size="sm" variant="secondary" onClick={market.reload} loading={market.pending === "refresh"} disabled={market.busy}>
              Retry
            </Button>
          </span>
        </Notice>
      )}
      {market.warnings.length > 0 && (
        <Notice tone="warn">
          {market.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </Notice>
      )}

      {/* Results region: dimmed and inert while an action is in flight, so the
          user can see that the numbers on screen are being replaced. */}
      <div
        aria-busy={market.busy}
        className={`grid gap-3 transition-opacity duration-200 sm:gap-4 ${
          market.busy ? "pointer-events-none opacity-55" : "opacity-100"
        }`}
      >
        <PriceBar
          symbol={analysis.symbol}
          name={analysis.symbolName}
          price={analysis.price}
          changePct={analysis.changePct}
          asOf={analysis.asOf}
          fetchedAt={analysis.fetchedAt}
          simulated={analysis.simulated}
        />

        <PredictionPanel analysis={analysis} tf={tf} />

        <Card className="relative">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground sm:text-base">
              Price chart — {tf?.label ?? market.interval}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Candles, EMA20/EMA50, Bollinger bands and support/resistance. Zoom and pan to inspect any stretch of the
              series.
            </p>
          </div>
          {chartIndicators ? (
            <Chart
              candles={market.candles}
              levels={tf?.levels}
              resetKey={`${market.symbol}:${market.interval}`}
              timeframeLabel={tf?.label}
              {...chartIndicators}
            />
          ) : (
            <Skeleton className="h-[280px] w-full sm:h-[360px] lg:h-[440px]" />
          )}
          <BusyOverlay active={market.busy} label={market.busyLabel} />
        </Card>

        <TimeframeTable
          timeframes={analysis.timeframes}
          selected={market.interval}
          onSelect={market.setInterval}
          pendingInterval={market.pending === "interval" ? market.interval : null}
          disabled={market.busy}
        />

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <SignalList signals={tf?.signals ?? []} />
          <RiskPanel tf={tf} />
        </div>

        <Methodology />
        <Disclaimer />
      </div>
    </div>
  );
}
