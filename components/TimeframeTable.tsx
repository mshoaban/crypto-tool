"use client";

import { Badge, Card, CardHeader } from "./ui";
import { formatPercent } from "@/lib/format";
import type { TimeframeAnalysis } from "@/lib/types";
import { biasMeta } from "./PredictionPanel";

export default function TimeframeTable({
  timeframes,
  selected,
  onSelect,
}: {
  timeframes: TimeframeAnalysis[];
  selected: string;
  onSelect: (interval: string) => void;
}) {
  return (
    <Card id="timeframes" className="scroll-mt-20">
      <CardHeader
        title="Multi-timeframe view"
        subtitle="Select a timeframe to inspect its chart, signals and risk"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Timeframe</th>
              <th className="py-2 pr-3 font-medium">Bias</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 pr-3 font-medium">Confidence*</th>
              <th className="py-2 pr-3 font-medium">Active signals</th>
              <th className="py-2 font-medium">Hist. hit rate</th>
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
                  onClick={() => onSelect(t.interval)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/40 ${
                    sel ? "bg-primary/5" : ""
                  }`}
                  aria-selected={sel}
                >
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(t.interval);
                      }}
                      className="font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
                      aria-pressed={sel}
                    >
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
      <p className="mt-3 text-[11px] text-muted-foreground">
        *Confidence is an analytical agreement score, not a probability of profit. Hit rate = walk-forward historical observation.
      </p>
    </Card>
  );
}