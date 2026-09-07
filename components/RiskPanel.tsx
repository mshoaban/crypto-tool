"use client";

import { Badge, Card, CardHeader, Stat } from "./ui";
import { formatPercent, formatPrice } from "@/lib/format";
import type { SupportResistance, TimeframeAnalysis } from "@/lib/types";

function levelTone(l: SupportResistance["label"]) {
  return l === "strong" ? "text-emerald-600 dark:text-emerald-400" : l === "moderate" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
}

export default function RiskPanel({ tf }: { tf: TimeframeAnalysis | null }) {
  if (!tf) return null;
  const r = tf.risk;
  const volLabel = r.volatility > 0.8 ? "High" : r.volatility > 0.4 ? "Elevated" : r.volatility > 0.2 ? "Moderate" : "Low";
  return (
    <Card id="risk" className="scroll-mt-20">
      <CardHeader
        title={`Risk & Levels — ${tf.label}`}
        subtitle="Volatility, structure and suggested exit framework (analysis only)"
        right={<Badge tone={volLabel === "High" ? "warn" : "info"}>{volLabel} volatility</Badge>}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="ATR" value={formatPercent(r.atrPct)} hint="% of price per bar" />
            <Stat label="Realized vol" value={`${(r.volatility * 100).toFixed(0)}%`} hint="Annualized est." />
            <Stat label="Z-score" value={r.zScore.toFixed(1)} hint="Recent move vs norm" />
          </dl>

          <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested framework ({tf.bias})
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-elevated p-3">
              <span className="block text-xs text-muted-foreground">Stop-loss</span>
              <span className="font-semibold text-foreground">{r.stopLoss != null ? formatPrice(r.stopLoss) : "—"}</span>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3">
              <span className="block text-xs text-muted-foreground">Take-profit</span>
              <span className="font-semibold text-foreground">{r.takeProfit != null ? formatPrice(r.takeProfit) : "—"}</span>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3">
              <span className="block text-xs text-muted-foreground">Invalidation</span>
              <span className="font-semibold text-foreground">{r.invalidation != null ? formatPrice(r.invalidation) : "—"}</span>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-3">
              <span className="block text-xs text-muted-foreground">Risk : Reward</span>
              <span className="font-semibold text-foreground">{r.riskReward != null ? `1 : ${r.riskReward.toFixed(1)}` : "—"}</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            ATR-based stops, structural invalidation and targets nearest to price. Suggested risk per trade (1%) is a generic risk-management guideline, not a recommendation.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Support & Resistance</h3>
          <ul className="space-y-1.5">
            {tf.levels.length === 0 && <li className="text-sm text-muted-foreground">No clear levels found in this window.</li>}
            {tf.levels.map((l, k) => (
              <li key={k} className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${l.kind === "support" ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
                  <span className="font-medium text-foreground">{l.kind === "support" ? "Support" : "Resistance"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatPrice(l.level)}</span>
                </span>
                <span className={`text-xs ${levelTone(l.label)}`}>
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