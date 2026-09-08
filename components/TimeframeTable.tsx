"use client";

import { Badge, Card, CardHeader, Spinner } from "./ui";
import { formatPercent } from "@/lib/format";
import type { TimeframeAnalysis } from "@/lib/types";
import { biasMeta } from "./PredictionPanel";

function hitRate(t: TimeframeAnalysis) {
  const b = t.backtest;
  return b.hitRate != null && b.samples > 0 ? `${formatPercent(b.hitRate * 100)} (${b.samples})` : `— (${b.samples})`;
}

export default function TimeframeTable({
  timeframes,
  selected,
  onSelect,
  pendingInterval = null,
  disabled = false,
}: {
  timeframes: TimeframeAnalysis[];
  selected: string;
  onSelect: (interval: string) => void;
  /** Timeframe whose data is being fetched right now. */
  pendingInterval?: string | null;
  disabled?: boolean;
}) {
  return (
    <Card id="timeframes" className="scroll-mt-24">
      <CardHeader title="Multi-timeframe view" subtitle="Pick a timeframe to inspect its chart, signals and risk" />

      {/* Mobile: tappable cards. A 6-column table cannot be read on a phone. */}
      <ul className="grid gap-2 sm:hidden">
        {timeframes.map((t) => {
          const meta = biasMeta(t.bias);
          const sel = t.interval === selected;
          return (
            <li key={t.interval}>
              <button
                type="button"
                onClick={() => onSelect(t.interval)}
                disabled={disabled}
                aria-pressed={sel}
                aria-busy={t.interval === pendingInterval || undefined}
                className={`grid w-full gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 ${
                  sel ? "border-primary bg-primary/5" : "border-border bg-elevated"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    {t.interval === pendingInterval && <Spinner className="h-3 w-3 text-primary" />}
                    {t.label}
                    {sel && <span className="text-[10px] font-medium uppercase tracking-wide text-primary">shown</span>}
                  </span>
                  <Badge tone={meta.tone}>{t.bias}</Badge>
                </span>
                <dl className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <div>
                    <dt>Score</dt>
                    <dd className={`text-sm font-semibold tabular-nums ${meta.color}`}>{t.score.toFixed(0)}</dd>
                  </div>
                  <div>
                    <dt>Confidence*</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">
                      {t.insufficientData ? "n/a" : `${t.confidence.toFixed(0)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Hit rate</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">{hitRate(t)}</dd>
                  </div>
                </dl>
                <span className="text-[11px] text-muted-foreground">
                  {t.signals.filter((s) => s.bias !== "neutral").length}/{t.signals.length} signals active
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Tablet and up: the full table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Timeframe</th>
              <th scope="col" className="py-2 pr-3 font-medium">Bias</th>
              <th scope="col" className="py-2 pr-3 font-medium">Score</th>
              <th scope="col" className="py-2 pr-3 font-medium">Confidence*</th>
              <th scope="col" className="py-2 pr-3 font-medium">Active signals</th>
              <th scope="col" className="py-2 font-medium">Hist. hit rate</th>
            </tr>
          </thead>
          <tbody>
            {timeframes.map((t) => {
              const meta = biasMeta(t.bias);
              const sel = t.interval === selected;
              const b = t.backtest;
              return (
                <tr
                  key={t.interval}
                  className={`border-b border-border transition-colors ${sel ? "bg-primary/5" : ""} ${
                    disabled ? "" : "cursor-pointer hover:bg-muted/40"
                  }`}
                  onClick={disabled ? undefined : () => onSelect(t.interval)}
                >
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(t.interval);
                      }}
                      disabled={disabled}
                      aria-pressed={sel}
                      aria-busy={t.interval === pendingInterval || undefined}
                      className="inline-flex items-center gap-2 rounded-md px-1 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                    >
                      {t.interval === pendingInterval && <Spinner className="h-3 w-3 text-primary" />}
                      {t.label}
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={meta.tone}>{t.bias}</Badge>
                  </td>
                  <td className={`py-3 pr-3 font-medium tabular-nums ${meta.color}`}>{t.score.toFixed(0)}</td>
                  <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                    {t.insufficientData ? "insufficient" : `${t.confidence.toFixed(0)}%`}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                    {t.signals.filter((s) => s.bias !== "neutral").length}/{t.signals.length}
                  </td>
                  <td className="py-3 tabular-nums">
                    {b.hitRate != null && b.samples > 0 ? (
                      <span className="font-medium text-foreground">{formatPercent(b.hitRate * 100)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className="ml-1 text-xs text-muted-foreground">({b.samples})</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        *Confidence is an analytical agreement score, not a probability of profit. Hit rate = walk-forward historical
        observation.
      </p>
    </Card>
  );
}
