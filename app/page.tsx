"use client";
import { useState, useCallback } from "react";
import { AnalysisResult, TradePlan, TimeframeResult } from "@/lib/analyzer";
import BacktestPanel from './components/BacktestPanel';

// ── Types ─────────────────────────────────────────────────
interface FormState { symbol: string; accountSize: string; riskPct: string; rrRatio: string; }

// ── Helpers ───────────────────────────────────────────────
function fmtN(n: number | null | undefined, d = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(d);
}
function fmtPrice(p: number): string {
  if (!p || isNaN(p)) return "—";
  if (p >= 1000) return p.toFixed(2);
  if (p >= 100) return p.toFixed(3);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(6);
  return p.toFixed(8);
}

// ── Score bar ─────────────────────────────────────────────
function ScoreBar({ value, max = 8 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  const color = value > 0 ? "var(--accent)" : value < 0 ? "var(--red)" : "var(--text-dim)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ flex: 1, height: 4, background: "var(--border2)", borderRadius: 2, position: "relative" }}>
        <div style={{
          position: "absolute",
          [value >= 0 ? "left" : "right"]: "50%",
          width: `${pct / 2}%`,
          height: "100%",
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 6px ${color}`,
          transition: "width 0.5s ease",
        }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: 8, background: "var(--text-muted)", transform: "translateY(-50%)" }} />
      </div>
      <span style={{ color, minWidth: 40, textAlign: "right", fontSize: 11, fontWeight: 700 }}>
        {value > 0 ? "+" : ""}{fmtN(value, 1)}
      </span>
    </div>
  );
}

// ── Signal Badge ──────────────────────────────────────────
function SignalBadge({ signal, grade }: { signal: string; grade: string }) {
  const colors: Record<string, { bg: string; fg: string; glow: string }> = {
    BUY: { bg: "var(--accent-dim)", fg: "var(--accent)", glow: "var(--accent-glow)" },
    SELL: { bg: "var(--red-dim)", fg: "var(--red)", glow: "rgba(255,59,92,0.3)" },
    NEUTRAL: { bg: "rgba(90,90,90,0.15)", fg: "var(--text-dim)", glow: "transparent" },
  };
  const gradeColor: Record<string, string> = { A: "var(--accent)", B: "#44aaff", C: "var(--yellow)", D: "var(--red)", NEUTRAL: "var(--text-dim)" };
  const { bg, fg, glow } = colors[signal] ?? colors.NEUTRAL;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        padding: "6px 20px", background: bg, border: `1px solid ${fg}`,
        color: fg, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 900,
        letterSpacing: 4, boxShadow: `0 0 20px ${glow}`,
        animation: signal !== "NEUTRAL" ? "glow-pulse 2s infinite" : "none",
      }}>
        {signal === "BUY" ? "▲ BUY" : signal === "SELL" ? "▼ SELL" : "◆ NEUTRAL"}
      </div>
      {grade !== "NEUTRAL" && (
        <div style={{
          width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
          border: `2px solid ${gradeColor[grade]}`, color: gradeColor[grade],
          fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900,
        }}>
          {grade}
        </div>
      )}
    </div>
  );
}

// ── Metric tile ───────────────────────────────────────────
function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: color ?? "var(--text)", fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</span>
      {sub && <span style={{ color: "var(--text-dim)", fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

// ── TF Card ───────────────────────────────────────────────
function TFCard({ tf }: { tf: TimeframeResult }) {
  const [open, setOpen] = useState(false);
  const { adj_score, raw_score, last, supports, resistances, patterns, detail } = tf;
  const signal = adj_score > 0 ? "BULL" : adj_score < 0 ? "BEAR" : "FLAT";
  const sigColor = signal === "BULL" ? "var(--accent)" : signal === "BEAR" ? "var(--red)" : "var(--text-dim)";

  return (
    <div style={{
      border: "1px solid var(--border)", background: "var(--surface)",
      overflow: "hidden", animation: "slide-in 0.3s ease forwards",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "14px 16px", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--accent)", minWidth: 40 }}>
          {tf.tf}
        </span>
        <span style={{ color: sigColor, fontSize: 11, fontWeight: 700, minWidth: 40 }}>{signal}</span>
        <div style={{ flex: 1 }}><ScoreBar value={adj_score} /></div>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border2)" }}>
          {/* Price data row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
            <Metric label="Price" value={fmtPrice(last.close)} />
            <Metric label="RSI" value={fmtN(last.RSI, 1)}
              color={last.RSI >= 70 ? "var(--red)" : last.RSI <= 30 ? "var(--accent)" : "var(--text)"} />
            <Metric label="ADX" value={fmtN(last.ADX, 1)}
              color={last.ADX >= 30 ? "var(--accent)" : last.ADX < 20 ? "var(--text-dim)" : "var(--text)"} />
            <Metric label="MACD" value={fmtN(last.MACD, 5)} sub={`Hist: ${fmtN(last.MACD_hist, 5)}`}
              color={last.MACD_hist > 0 ? "var(--accent)" : "var(--red)"} />
            <Metric label="StochRSI K/D" value={`${fmtN(last.StochK, 0)} / ${fmtN(last.StochD, 0)}`} />
            <Metric label="BB%" value={`${fmtN(last.BB_pct * 100, 0)}%`}
              color={last.BB_pct > 0.8 ? "var(--red)" : last.BB_pct < 0.2 ? "var(--accent)" : "var(--text)"} />
          </div>

          {/* Score breakdown */}
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>SCORE BREAKDOWN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {Object.entries(detail).filter(([k]) => k !== "SR_notes").map(([key, val]) => {
                const v = val as string;
                const col = v.startsWith("+") ? "var(--accent)" : v.startsWith("-") ? "var(--red)" : "var(--text-dim)";
                return (
                  <div key={key} style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    <span style={{ color: "var(--text-muted)", minWidth: 80 }}>{key}</span>
                    <span style={{ color: col }}>{v}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* S/R notes */}
          {detail.SR_notes?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {detail.SR_notes.map((note, i) => (
                <div key={i} style={{
                  fontSize: 11, padding: "4px 8px", marginBottom: 3,
                  background: note.includes("DANGER") ? "var(--red-dim)" : note.includes("CAUTION") ? "var(--yellow-dim)" : "var(--accent-dim)",
                  color: note.includes("DANGER") ? "var(--red)" : note.includes("CAUTION") ? "var(--yellow)" : "var(--accent)",
                  borderLeft: `2px solid ${note.includes("DANGER") ? "var(--red)" : note.includes("CAUTION") ? "var(--yellow)" : "var(--accent)"}`,
                }}>
                  {note}
                </div>
              ))}
            </div>
          )}

          {/* S/R levels */}
          {(resistances.length > 0 || supports.length > 0) && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>RESISTANCES</div>
                {resistances.slice(0, 3).map((r, i) => {
                  const dist = (r.price - last.close) / last.close * 100;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--red)", marginBottom: 2 }}>
                      <span>R{i + 1}: {fmtPrice(r.price)}</span>
                      <span style={{ color: "var(--text-dim)" }}>+{dist.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>SUPPORTS</div>
                {supports.slice(0, 3).map((s, i) => {
                  const dist = (last.close - s.price) / last.close * 100;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--accent)", marginBottom: 2 }}>
                      <span>S{i + 1}: {fmtPrice(s.price)}</span>
                      <span style={{ color: "var(--text-dim)" }}>-{dist.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {patterns.map(([name, dir], i) => (
                <span key={i} style={{
                  fontSize: 10, padding: "2px 8px",
                  background: dir === "bullish" ? "var(--accent-dim)" : dir === "bearish" ? "var(--red-dim)" : "rgba(90,90,90,0.15)",
                  color: dir === "bullish" ? "var(--accent)" : dir === "bearish" ? "var(--red)" : "var(--text-dim)",
                  border: `1px solid ${dir === "bullish" ? "var(--accent)" : dir === "bearish" ? "var(--red)" : "var(--border)"}`,
                  letterSpacing: 1,
                }}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trade Plan Panel ──────────────────────────────────────
function TradePlanPanel({ plan }: { plan: TradePlan }) {
  const isLong = plan.signal === "BUY";
  const color = isLong ? "var(--accent)" : "var(--red)";
  const dimColor = isLong ? "var(--accent-dim)" : "var(--red-dim)";

  const PriceRow = ({ label, value, sub, highlight = false, warn = false }:
    { label: string; value: string; sub?: string; highlight?: boolean; warn?: boolean }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 12px",
      background: highlight ? dimColor : warn ? "var(--red-dim)" : "transparent",
      borderBottom: "1px solid var(--border2)",
    }}>
      <span style={{ color: warn ? "var(--red)" : "var(--text-dim)", fontSize: 11 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ color: highlight ? color : warn ? "var(--red)" : "var(--text)", fontWeight: 700, fontSize: 13 }}>{value}</span>
        {sub && <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{sub}</div>}
      </div>
    </div>
  );

  const evIcon = plan.expected_value > 0.2 ? "✅" : plan.expected_value > 0 ? "⚡" : "⚠";

  return (
    <div style={{ border: `1px solid ${color}`, background: "var(--surface)", boxShadow: `0 0 20px ${isLong ? "var(--accent-glow)" : "rgba(255,59,92,0.15)"}` }}>
      <div style={{
        padding: "12px 16px", background: dimColor, borderBottom: `1px solid ${color}`,
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color,
        letterSpacing: 2,
      }}>
        {isLong ? "▲" : "▼"} TRADE PLAN — {plan.signal}
      </div>

      {/* Entry / SL / TPs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border2)" }}>
        <div style={{ background: "var(--surface)" }}>
          <div style={{ padding: "8px 12px", background: "var(--border2)", fontSize: 10, letterSpacing: 2, color: "var(--text-muted)" }}>ENTRY</div>
          <PriceRow label="Market Entry" value={fmtPrice(plan.entry)} highlight />
          <PriceRow label="Ideal Entry" value={fmtPrice(plan.entry_ideal)} sub="slight pullback" />
        </div>
        <div style={{ background: "var(--surface)" }}>
          <div style={{ padding: "8px 12px", background: "var(--border2)", fontSize: 10, letterSpacing: 2, color: "var(--text-muted)" }}>STOP LOSS</div>
          <PriceRow label="Stop Loss" value={fmtPrice(plan.stop_loss)} warn />
          <PriceRow label="Distance" value={`${plan.risk_pct_price.toFixed(2)}%`} sub={fmtPrice(plan.risk_per_unit)} />
        </div>
      </div>

      {/* TPs */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 8 }}>TAKE PROFITS</div>
        {[
          { label: `TP1  1:${plan.rr1.toFixed(1)} RR`, price: plan.tp1, pct: Math.abs(plan.tp1 - plan.entry) / plan.entry * 100, exit: "40%" },
          { label: `TP2  1:${plan.rr2.toFixed(1)} RR`, price: plan.tp2, pct: Math.abs(plan.tp2 - plan.entry) / plan.entry * 100, exit: "40%", warn: plan.tp2_blocked },
          { label: `TP3  1:${plan.rr3.toFixed(1)} RR`, price: plan.tp3, pct: Math.abs(plan.tp3 - plan.entry) / plan.entry * 100, exit: "20%" },
        ].map((tp, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 0", borderBottom: i < 2 ? "1px solid var(--border2)" : "none",
          }}>
            <span style={{ color: "var(--text-dim)", fontSize: 11, minWidth: 120 }}>{tp.label}</span>
            <span style={{ color: tp.warn ? "var(--yellow)" : color, fontWeight: 700, fontSize: 13 }}>{fmtPrice(tp.price)}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>+{tp.pct.toFixed(2)}%</span>
            <span style={{
              fontSize: 10, padding: "1px 6px",
              background: "var(--surface2)", color: "var(--text-dim)", border: "1px solid var(--border2)",
            }}>exit {tp.exit}</span>
          </div>
        ))}

        {plan.tp2_blocked && (
          <div style={{
            marginTop: 8, padding: "6px 10px",
            background: "var(--yellow-dim)", color: "var(--yellow)",
            fontSize: 11, borderLeft: "2px solid var(--yellow)",
          }}>
            ⚠ S/R level sits between entry and TP2. Consider moving TP2 earlier.
          </div>
        )}
      </div>

      {/* Position sizing */}
      <div style={{ borderTop: "1px solid var(--border2)", padding: "12px 16px" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 8 }}>POSITION SIZING  (Account: ${plan.account_size.toLocaleString()})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Metric label="Risk Amount" value={`$${plan.risk_amount.toFixed(2)}`} sub={`${((plan.risk_amount / plan.account_size) * 100).toFixed(1)}% of account`} />
          <Metric label="Position Size" value={`$${plan.position_size_usdt.toLocaleString()}`} sub={`${plan.position_pct}% of account`} />
          <Metric label="Qty (units)" value={`${plan.position_size_units}`} />
        </div>
      </div>

      {/* EV + checklist */}
      <div style={{ borderTop: "1px solid var(--border2)", padding: "12px 16px", background: "var(--surface2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-muted)" }}>EXPECTED VALUE (55% WR)</span>
          <span style={{ color: plan.expected_value > 0 ? "var(--accent)" : "var(--red)", fontWeight: 700 }}>
            {plan.expected_value > 0 ? "+" : ""}{plan.expected_value.toFixed(3)}× {evIcon}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 3 }}>
          {["Wait for entry candle to CLOSE above/below key level",
            "Set SL immediately after entry — no exceptions",
            "Move SL to breakeven after TP1 is hit",
            "Let TP2 run with trailing SL from breakeven",
            "Close remaining 20% at TP3 or trail tighter"].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: color }}>›</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function Home() {
  const [form, setForm] = useState<FormState>({ symbol: "BTCUSDT", accountSize: "1000", riskPct: "1", rrRatio: "2" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("Connecting to exchange...");

  const loadingMessages = [
    "Connecting to exchange...",
    "Fetching OHLCV data (15m / 1h / 4h)...",
    "Computing 12 technical indicators...",
    "Mapping support & resistance levels...",
    "Scoring timeframes and building trade plan...",
  ];

  const analyze = useCallback(async () => {
    if (!form.symbol.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let msgIdx = 0;
    setLoadingMsg(loadingMessages[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      setLoadingMsg(loadingMessages[msgIdx]);
    }, 2000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          accountSize: parseFloat(form.accountSize) || 1000,
          riskPct: parseFloat(form.riskPct) || 1,
          rrRatio: parseFloat(form.rrRatio) || 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [form]);

  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<any | null>(null);

  const runBacktest = useCallback(async () => {
    setBacktestLoading(true); setBacktestResult(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: form.symbol.trim().toUpperCase(), timeframe: '1h', accountSize: parseFloat(form.accountSize) || 1000 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      setBacktestResult(data);
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally { setBacktestLoading(false); }
  }, [form]);

  const inputStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13,
    padding: "12px 14px", outline: "none", width: "100%", minHeight: 44,
    borderRadius: 10,
  };

  const POPULAR = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 6, color: "var(--text-muted)", marginBottom: 8 }}>
          ◈ PROFESSIONAL TRADING SYSTEM ◈
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900,
          color: "var(--accent)", letterSpacing: 4,
          textShadow: "0 0 30px var(--accent-glow), 0 0 60px var(--accent-dim)",
        }}>
          CRYPTO PRO ANALYZER
        </h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 6, letterSpacing: 2 }}>
          MULTI-TIMEFRAME · TRADE PLANNER · S/R ENGINE · SIGNAL GRADER
        </div>
      </div>

      {/* Input Panel */}
      <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 12 }}>ANALYSIS PARAMETERS</div>

        {/* Quick picks */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {POPULAR.map(sym => (
            <button key={sym}
              onClick={() => setForm(f => ({ ...f, symbol: sym }))}
              style={{
                padding: "6px 14px", background: form.symbol === sym ? "var(--accent-dim)" : "var(--surface2)",
                borderRadius: 999, border: `1px solid ${form.symbol === sym ? "var(--accent)" : "var(--border)"}`,
                color: form.symbol === sym ? "var(--accent)" : "var(--text-dim)",
                fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer", letterSpacing: 1,
                transition: "all 0.2s ease",
              }}>
              {sym.replace("USDT", "")}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>TRADING PAIR</div>
            <input
              value={form.symbol}
              onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              onKeyDown={e => e.key === "Enter" && analyze()}
              placeholder="e.g. BTCUSDT"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>ACCOUNT ($)</div>
            <input value={form.accountSize} onChange={e => setForm(f => ({ ...f, accountSize: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>RISK %</div>
            <input value={form.riskPct} onChange={e => setForm(f => ({ ...f, riskPct: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>RR RATIO</div>
            <input value={form.rrRatio} onChange={e => setForm(f => ({ ...f, rrRatio: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={loading}
          style={{
            marginTop: 16, width: "100%", padding: "14px", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "var(--surface2)" : "var(--accent)",
            border: `1px solid ${loading ? "var(--border)" : "var(--accent)"}`,
            color: loading ? "var(--text-muted)" : "var(--surface)",
            fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 2, fontWeight: 700,
            borderRadius: 12, boxShadow: loading ? "none" : "0 0 20px var(--accent-glow)",
            transition: "all 0.2s",
          }}>
          {loading ? "ANALYZING..." : "▶  ANALYZE"}
        </button>
        <button
          onClick={runBacktest}
          disabled={backtestLoading}
          style={{
            marginTop: 10, width: '100%', padding: '12px', cursor: backtestLoading ? 'not-allowed' : 'pointer',
            background: backtestLoading ? 'var(--surface2)' : 'var(--surface)',
            border: `1px solid ${backtestLoading ? 'var(--border)' : 'var(--border2)'}`,
            color: 'var(--text)', fontSize: 13, fontWeight: 700, borderRadius: 12,
            letterSpacing: 1.5,
          }}
        >
          {backtestLoading ? 'RUNNING BACKTEST...' : '⟲ Run Backtest (1h)'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          border: "1px solid var(--border)", background: "var(--surface)",
          padding: 40, textAlign: "center",
        }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 12, color: "var(--accent)",
            letterSpacing: 3, marginBottom: 16, animation: "pulse-green 1.5s infinite",
          }}>
            ◈ PROCESSING ◈
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
            {loadingMsg}
            <span style={{ animation: "blink 1s step-end infinite" }}>_</span>
          </div>
          {/* Fake progress bar */}
          <div style={{ marginTop: 20, height: 2, background: "var(--border2)", position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: "-30%", height: "100%", width: "30%",
              background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
              animation: "scan 1.5s linear infinite",
            }} />
          </div>
          <style>{`@keyframes scan { from { left: -30%; } to { left: 130%; } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          border: "1px solid var(--red)", background: "var(--red-dim)",
          padding: 16, color: "var(--red)", fontSize: 12,
        }}>
          ⚠ ERROR: {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ animation: "slide-in 0.4s ease forwards" }}>

          {/* Overview strip */}
          <div style={{
            border: "1px solid var(--border)", background: "var(--surface)",
            padding: "16px 20px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 900, color: "var(--text)", letterSpacing: 2 }}>
                {result.symbol}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
                {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 900, color: "var(--accent)" }}>
              {fmtPrice(result.price)}
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>USDT</span>
            </div>
            <SignalBadge signal={result.signal} grade={result.grade} />
          </div>

          {/* Grade text */}
          <div style={{
            border: `1px solid ${result.grade === "A" ? "var(--accent)" : result.grade === "B" ? "#44aaff" : result.grade === "C" ? "var(--yellow)" : "var(--border)"}`,
            background: "var(--surface2)", padding: "10px 16px", marginBottom: 16,
            color: result.grade === "A" ? "var(--accent)" : result.grade === "B" ? "#44aaff" : result.grade === "C" ? "var(--yellow)" : "var(--text-dim)",
            fontSize: 12,
          }}>
            {result.grade_text}
          </div>

          {/* Market overview metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Metric label="Macro Bias"
              value={result.bias}
              color={result.bias === "MACRO BULL" ? "var(--accent)" : "var(--red)"} />
            <Metric label="Market Structure" value={result.struct_4h}
              color={result.struct_4h.includes("UP") ? "var(--accent)" : result.struct_4h.includes("DOWN") ? "var(--red)" : "var(--yellow)"} />
            <Metric label="ATR (4h)" value={fmtPrice(result.atr_4h)} sub={`${(result.atr_4h / result.price * 100).toFixed(2)}% of price`} />
            <Metric label="ADX (4h)" value={fmtN(result.adx_4h, 1)}
              color={result.adx_4h >= 30 ? "var(--accent)" : result.adx_4h < 20 ? "var(--text-dim)" : "var(--text)"} />
          </div>

          {/* TF scores summary */}
          <div style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 12 }}>TIMEFRAME SCORES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["15m", "1h", "4h"].map(tf => (
                <div key={tf} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--accent)", minWidth: 36 }}>{tf}</span>
                  <div style={{ flex: 1 }}><ScoreBar value={result.adj_scores[tf]} /></div>
                  <span style={{ color: "var(--text-muted)", fontSize: 10, minWidth: 80, textAlign: "right" }}>
                    raw {result.raw_scores[tf] > 0 ? "+" : ""}{fmtN(result.raw_scores[tf], 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeframe cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {result.timeframes.map(tf => <TFCard key={tf.tf} tf={tf} />)}
          </div>

          {/* Trade plan */}
          {result.plan ? (
            <TradePlanPanel plan={result.plan} />
          ) : (
            <div style={{
              border: "1px solid var(--border)", background: "var(--surface)",
              padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 12,
            }}>
              <div style={{ fontSize: 14, marginBottom: 8, color: "var(--text-muted)" }}>◈ NO TRADE PLAN</div>
              {Object.values(result.adj_scores).reduce((a, b) => a + b, 0) >= 3 ?
                "Bias: LEANING BULLISH — wait for full 15m/1h/4h alignment" :
                Object.values(result.adj_scores).reduce((a, b) => a + b, 0) <= -3 ?
                  "Bias: LEANING BEARISH — wait for full 15m/1h/4h alignment" :
                  "Mixed signals — no edge detected. Stay out and wait."}
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop: 24, padding: "12px 16px", border: "1px solid var(--border2)", color: "var(--text-muted)", fontSize: 10, letterSpacing: 0.5 }}>
            ⚠ DISCLAIMER: Educational purposes only. Not financial advice. Always do your own research.
            Past performance does not guarantee future results. Never risk money you cannot afford to lose.
          </div>
          {backtestResult && (
            <div style={{ marginTop: 18 }}>
              <BacktestPanel data={backtestResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
