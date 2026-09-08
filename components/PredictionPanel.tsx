"use client";

import type { ReactNode } from "react";
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

/**
 * The verdict summary is generated locally and marks key terms with <strong>.
 * Rather than pushing it through dangerouslySetInnerHTML, translate just that
 * one tag into real elements — anything else stays inert text.
 */
function renderEmphasis(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<strong>(.*?)<\/strong>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={key++} className="font-semibold text-foreground">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Gauge({ score }: { score: number }) {
  const pct = ((score + 100) / 200) * 100;
  return (
    <div className="w-full" role="img" aria-label={`Composite score ${score.toFixed(0)} on a scale from -100 to +100`}>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-zinc-300 to-emerald-500 dark:via-zinc-700">
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-zinc-900/50 dark:bg-zinc-100/50" />
        <div
          className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-foreground shadow transition-[left] duration-500"
          style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground sm:text-[11px]">
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
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Historical hit rate</span>
        <Badge tone="info">{tf.label}</Badge>
      </div>
      {hasData ? (
        <>
          <div className="flex flex-wrap items-end gap-x-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                b.hitRate! >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {(b.hitRate! * 100).toFixed(1)}%
            </span>
            <span className="mb-1 text-[11px] text-muted-foreground">correct direction · {b.samples} samples</span>
          </div>
          {b.avgReturnPct != null && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Avg move per signal: {formatPercent(b.avgReturnPct)} over {b.horizonBars} bar(s).
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">{b.note}</p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Walk-forward, out-of-sample test of this signal set on historical data — a measure of past behavior,{" "}
        <strong className="text-foreground">not</strong> a guarantee.
      </p>
    </div>
  );
}

export default function PredictionPanel({ analysis, tf }: { analysis: AnalysisResult; tf: TimeframeAnalysis | null }) {
  const o = analysis.overall;
  const meta = biasMeta(o.bias);
  const chosen = tf ?? analysis.timeframes[0];

  return (
    <Card id="overview" className="scroll-mt-24">
      <CardHeader
        title="Prediction & Verdict"
        subtitle="Analytical bias across timeframes — not financial advice"
        right={<Badge tone={meta.tone}>{meta.label}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-5">
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className={`text-xl font-bold sm:text-2xl ${meta.color}`}>
              {meta.arrow} {meta.label}
            </span>
            <span className="text-[13px] text-muted-foreground sm:text-sm">Score {o.score.toFixed(0)} / 100</span>
          </div>
          <Gauge score={o.score} />
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{renderEmphasis(o.summary)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Analytical confidence"
              value={`${o.confidence.toFixed(0)}%`}
              hint="Agreement-based score, NOT probability"
            />
            <Stat
              label="Active timeframes"
              value={`${analysis.timeframes.filter((t) => !t.insufficientData).length}/${analysis.timeframes.length}`}
              hint="Reliable TF count"
            />
            <Stat
              label="Signals"
              value={tf ? tf.signals.filter((s) => s.bias !== "neutral").length : "—"}
              hint="Active on selected TF"
            />
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          {chosen && <BacktestCard tf={chosen} />}
          <div className="rounded-xl border border-border bg-elevated p-3 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            <p className="font-semibold text-foreground">How to read confidence</p>
            <p className="mt-1">
              Confidence is an <strong>analytical score</strong> built from indicator agreement, data history and
              completeness. It is intentionally <em>not</em> a probability of profit. The only profit-related measure shown
              is the historical hit rate above.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
