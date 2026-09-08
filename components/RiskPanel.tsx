"use client";

import { Badge, Card, CardHeader, Stat } from "./ui";
import { formatPercent, formatPrice } from "@/lib/format";
import type { SupportResistance, TimeframeAnalysis } from "@/lib/types";

function levelTone(l: SupportResistance["label"]) {
  return l === "strong"
    ? "text-emerald-600 dark:text-emerald-400"
    : l === "moderate"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
}

export default function RiskPanel({ tf }: { tf: TimeframeAnalysis | null }) {
  if (!tf) return null;
  const r = tf.risk;
  const volLabel = r.volatility > 0.8 ? "High" : r.volatility > 0.4 ? "Elevated" : r.volatility > 0.2 ? "Moderate" : "Low";
  const framework = [
    ["Stop-loss", r.stopLoss != null ? formatPrice(r.stopLoss) : "—"],
    ["Take-profit", r.takeProfit != null ? formatPrice(r.takeProfit) : "—"],
    ["Invalidation", r.invalidation != null ? formatPrice(r.invalidation) : "—"],
    ["Risk : Reward", r.riskReward != null ? `1 : ${r.riskReward.toFixed(1)}` : "—"],
  ] as const;

  return (
    <Card id="risk" className="scroll-mt-24">
      <CardHeader
        title={`Risk & Levels — ${tf.label}`}
        subtitle="Volatility, structure and suggested exit framework (analysis only)"
        right={<Badge tone={volLabel === "High" ? "warn" : "info"}>{volLabel} volatility</Badge>}
      />
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <div>
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="ATR" value={formatPercent(r.atrPct)} hint="% of price per bar" />
            <Stat label="Realized vol" value={`${(r.volatility * 100).toFixed(0)}%`} hint="Annualized est." />
            <Stat label="Z-score" value={r.zScore.toFixed(1)} hint="Recent move vs norm" />
          </dl>

          <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
            Suggested framework ({tf.bias})
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:gap-3">
            {framework.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-elevated p-2.5 sm:p-3">
                <dt className="block text-[11px] text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            ATR-based stops, structural invalidation and targets nearest to price. Suggested risk per trade (1%) is a
            generic risk-management guideline, not a recommendation.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
            Support &amp; Resistance
          </h3>
          <ul className="space-y-1.5">
            {tf.levels.length === 0 && (
              <li className="text-[13px] text-muted-foreground sm:text-sm">No clear levels found in this window.</li>
            )}
            {tf.levels.map((l, k) => (
              <li
                key={k}
                className="flex flex-col gap-1 rounded-lg border border-border bg-elevated px-3 py-2 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${l.kind === "support" ? "bg-bull" : "bg-bear"}`}
                    aria-hidden
                  />
                  <span className="font-medium text-foreground">{l.kind === "support" ? "Support" : "Resistance"}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatPrice(l.level)}</span>
                </span>
                <span className={`text-[11px] sm:text-xs ${levelTone(l.label)}`}>
                  {formatPercent(l.distancePct * 100, false)} · {l.label} · {l.touches} touch{l.touches === 1 ? "" : "es"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
