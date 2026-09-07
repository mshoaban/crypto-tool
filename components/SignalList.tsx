"use client";

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
  return (
    <Card id="signals" className="scroll-mt-20">
      <CardHeader
        title={`Signals — why this read (${signals.length})`}
        subtitle="Every signal shows the raw value and the reasoning behind it"
      />
      <ul className="divide-y divide-border">
        {signals.map((s) => {
          const meta = biasMeta(s.bias);
          return (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              <div className="grid gap-2 sm:grid-cols-[minmax(9rem,22%)_1fr] sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${meta.color}`}>{meta.arrow}</span>
                    <span className="text-sm font-semibold text-foreground">{s.name}</span>
                  </div>
                  <p className="ml-4 text-[11px] uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[s.group]}</p>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.bias === "bullish" ? "bull" : s.bias === "bearish" ? "bear" : "neutral"}>{s.bias}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{s.detail}</span>
                    <span className="ml-auto text-xs text-muted-foreground">weight {s.weight > 0 ? "+" : ""}{s.weight.toFixed(1)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.why}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}