"use client";

import { useState } from "react";
import { Badge, Card, CardHeader } from "./ui";
import { biasMeta } from "./PredictionPanel";
import type { Signal } from "@/lib/types";

const GROUP_LABEL: Record<Signal["group"], string> = {
  trend: "Trend",
  momentum: "Momentum",
  "mean-reversion": "Mean reversion",
  volatility: "Volatility",
  volume: "Volume",
};

export default function SignalList({ signals }: { signals: Signal[] }) {
  const [activeOnly, setActiveOnly] = useState(false);
  const activeCount = signals.filter((s) => s.bias !== "neutral").length;
  const shown = activeOnly ? signals.filter((s) => s.bias !== "neutral") : signals;

  return (
    <Card id="signals" className="scroll-mt-24">
      <CardHeader
        title={`Signals — why this read (${activeCount}/${signals.length} active)`}
        subtitle="Every signal shows the raw value and the reasoning behind it"
        right={
          signals.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveOnly((v) => !v)}
              aria-pressed={activeOnly}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeOnly
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-elevated text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Active only
            </button>
          )
        }
      />
      {shown.length === 0 ? (
        <p className="py-2 text-[13px] text-muted-foreground sm:text-sm">
          {signals.length === 0 ? "No signals for this timeframe." : "No directional signals right now — every indicator reads neutral."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((s) => {
            const meta = biasMeta(s.bias);
            return (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                <div className="grid gap-1.5 sm:grid-cols-[minmax(9rem,22%)_1fr] sm:items-start sm:gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${meta.color}`} aria-hidden>
                        {meta.arrow}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground sm:text-sm">{s.name}</span>
                    </div>
                    <p className="ml-4 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                      {GROUP_LABEL[s.group]}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone={s.bias === "bullish" ? "bull" : s.bias === "bearish" ? "bear" : "neutral"}>
                        {s.bias}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">{s.detail}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        weight {s.weight > 0 ? "+" : ""}
                        {s.weight.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{s.why}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
