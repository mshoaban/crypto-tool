"use client";
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Scatter, ScatterChart } from 'recharts';

function tsToLabel(t: number) { return new Date(t).toLocaleDateString(); }

export default function BacktestPanel({ data }: { data: any }) {
  if (!data) return null;

  const equity = data.equitySeries.map((p: any) => ({ t: p.t, balance: Math.round(p.balance * 100) / 100 }));
  const prices = data.priceSeries.map((p: any) => ({ t: p.t, price: p.price }));
  const trades = data.trades.map((t: any, i: number) => ({ ...t, id: i }));

  return (
    <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1.5 }}>TOTAL P&L</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6, color: data.totalPnL >= 0 ? 'var(--accent)' : 'var(--red)' }}>${data.totalPnL.toFixed(2)}</div>
        </div>
        <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1.5 }}>WIN RATE</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>{data.winRate.toFixed(1)}%</div>
        </div>
        <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1.5 }}>TOTAL TRADES</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>{data.totalTrades}</div>
        </div>
        <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1.5 }}>FINAL BALANCE</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>${data.finalBalance.toFixed(2)}</div>
        </div>
        <div style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 1.5 }}>MAX DRAWDOWN</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 6 }}>{data.maxDrawdown}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
        <div style={{ border: '1px solid var(--border2)', padding: 12, background: 'var(--surface)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>EQUITY CURVE</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="t" tickFormatter={tsToLabel} />
                <YAxis />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Line type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border2)', padding: 12, background: 'var(--surface)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>TRADE HISTORY</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <XAxis dataKey="t" name="time" tickFormatter={tsToLabel} />
                <YAxis dataKey="price" name="price" />
                <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : v)} labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Scatter data={prices} fill="#8884d8" />
                {trades.map((tr: any) => (
                  <Scatter key={tr.id} data={[{ t: rowsafe(tr.entryIndex, data), price: tr.entryPrice }]} fill={tr.pnl >= 0 ? '#22c55e' : '#ff4d6d'} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border2)', padding: 12, background: 'var(--surface)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>PNL PER TRADE</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trades}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : v)} />
              <Bar dataKey="pnl" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border2)', padding: 12, background: 'var(--surface)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>TRADES (most recent first)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trades.slice().reverse().map((t: any) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 8, border: '1px solid var(--border2)', background: 'var(--surface2)' }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 800 }}>{t.side} — {new Date(tsFromIndex(t.entryIndex, data)).toLocaleString()} → {new Date(tsFromIndex(t.exitIndex, data)).toLocaleString()}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.entryPrice.toFixed(4)} → {t.exitPrice.toFixed(4)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, color: t.pnl >= 0 ? 'var(--accent)' : 'var(--red)' }}>${t.pnl.toFixed(2)}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{t.reason && Object.entries(t.reason).slice(0,3).map(([k,v]) => `${k}: ${String(v)}`).join(' • ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function rowsafe(idx: number, data: any) {
  const ps = data.priceSeries;
  if (!ps || ps.length === 0) return Date.now();
  const i = Math.max(0, Math.min(ps.length - 1, idx));
  return ps[i].t;
}
function tsFromIndex(idx: number, data: any) { return rowsafe(idx, data); }
