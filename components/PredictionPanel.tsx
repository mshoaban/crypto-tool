"use client";

import { Badge, Card, CardHeader, Stat } from "./ui";
import { formatPercent } from "@/lib/format";
import type { AnalysisResult, SignalBias, TimeframeAnalysis } from "@/lib/types";

export function biasMeta(bias: SignalBias) {
  switch (bias) {
    case "bullish":
      return { label: "Bullish", tone: "bull" as const, arrow: "▲", color: "text-emerald-600 dark:text-emerald-400" };
    case "bearish":
      return { label: "Bearish", tone: "bear" as const, arrow: "▼", color: "text-red-600 dark:text-red-400" };
    default:
      return { label: "Neutral", tone: "neutral" as const, arrow: "◆", color: "text-zinc-600 dark:text-zinc-300" };
  }
}

function Gauge({ score }: { score: number }) {
  const pct = ((score + 100) / 200) * 100;
  return (
    <div className="w-full" role="img" aria-label={`Composite score ${score.toFixed(0)} out of 100`}>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-zinc-300 to-emerald-500 dark:via-zinc-700">
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-zinc-900/50 dark:bg-zinc-100/50" />
        <div
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-foreground shadow transition-[left] duration-500"
          style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Bearish −100</span>
        <span>Neutral 0</span>
        <span>Bullish +100</span>
      </div>
    </div>
  );
}

function BacktestCard({ tf }: { tf: TimeframeAnalysis }) {
  const b = tf.backtest;
  const hasData = b.hitRate != null && b.samples > 0;
  const pct = hasData ? (b.hitRate! * 100).toFixed(1) : "—";
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Historical hit rate</span>
        <Badge tone="info">{tf.label}</Badge>
      </div>
      {hasData ? (
        <>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-bold tabular-nums ${b.hitRate! >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {pct}%
            </span>
            <span className="mb-1 text-xs text-muted-foreground">correct direction · {b.samples} samples</span>
          </div>
          {b.avgReturnPct != null && (
            <p className="mt-1 text-xs text-muted-foreground">Avg move per signal: {formatPercent(b.avgReturnPct)} over {b.horizonBars} bar(s).</p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{b.note}</p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Walk-forward, out-of-sample test of this signal set on historical data — a measure of past behavior, <strong className="text-foreground">not</strong> a guarantee.
      </p>
    </div>
  );
}

export default function PredictionPanel({ analysis, tf }: { analysis: AnalysisResult; tf: TimeframeAnalysis | null }) {
  const o = analysis.overall;
  const meta = biasMeta(o.bias);
  const chosen = tf ?? analysis.timeframes[0];

  return (
    <Card id="overview" className="scroll-mt-20">
      <CardHeader
        title="Prediction & Verdict"
        subtitle="Analytical bias across timeframes — not financial advice"
        right={<Badge tone={meta.tone}>{meta.label}</Badge>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${meta.color}`}>
              {meta.arrow} {meta.label}
            </span>
            <span className="text-sm text-muted-foreground">Score {o.score.toFixed(0)} / 100</span>
          </div>
          <Gauge score={o.score} />
          <p
            className="mt-3 text-sm leading-relaxed text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: o.summary }}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Analytical confidence" value={<span className="text-lg">{o.confidence.toFixed(0)}%</span>} hint="Agreement-based score, NOT probability" />
            <Stat label="Active timeframes" value={`${analysis.timeframes.filter((t) => !t.insufficientData).length}/${analysis.timeframes.length}`} hint="Reliable TF count" />
            <Stat label="Signals" value={tf ? tf.signals.filter((s) => s.bias !== "neutral").length : "—"} hint="Active on selected TF" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {chosen && <BacktestCard tf={chosen} />}
          <div className="rounded-xl border border-border bg-elevated p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">How to read confidence</p>
            <p className="mt-1 leading-relaxed">
              Confidence is an <strong>analytical score</strong> built from indicator agreement, data history and completeness. It is
              intentionally <em>not</em> a probability of profit. The only profit-related measure shown is the historical hit rate above.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}