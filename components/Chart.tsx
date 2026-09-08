"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice, formatCompact } from "@/lib/format";
import type { Candle, SupportResistance } from "@/lib/types";

interface ChartProps {
  candles: Candle[];
  ema20?: (number | null)[];
  ema50?: (number | null)[];
  sma50?: (number | null)[];
  bbUpper?: (number | null)[];
  bbLower?: (number | null)[];
  bbMid?: (number | null)[];
  levels?: SupportResistance[];
  height?: number;
}

const WIDTH_PAD = 10;
const X_TICKS = 6;

export default function Chart({
  candles,
  ema20,
  ema50,
  sma50,
  bbUpper,
  bbLower,
  bbMid,
  levels = [],
  height = 440,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const n = candles.length;
    if (n === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const overlays = [bbUpper, bbLower, bbMid, ema20, ema50, sma50];
    for (const ov of overlays) {
      if (!ov) continue;
      for (const v of ov) {
        if (v == null || !Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const levelsF = levels.map((l) => l.level);
    for (const l of levelsF) {
      if (l < min) min = l;
      if (l > max) max = l;
    }
    const pad = (max - min) * 0.06 || max * 0.01 || 1;
    min -= pad;
    max += pad;

    const priceH = height - 64; // leave room for volume + x labels
    const volumeH = 48;
    const plotTop = 8;
    const priceBottom = plotTop + priceH;
    const volumeTop = priceBottom + 10;
    const volumeBottom = volumeTop + volumeH;

    const x = (i: number) => WIDTH_PAD + (i / (n - 1)) * (width - WIDTH_PAD * 2);
    const y = (p: number) => plotTop + (1 - (p - min) / (max - min)) * priceH;
    const volScale = (v: number) => {
      let vMax = 0;
      for (const c of candles) if (c.volume > vMax) vMax = c.volume;
      return vMax === 0 ? 0 : (v / vMax) * (volumeBottom - volumeTop);
    };

    // X-axis tick times.
    const ticks: { label: string; x: number }[] = [];
    for (let k = 0; k < X_TICKS; k++) {
      const idx = Math.round((k / (X_TICKS - 1)) * (n - 1));
      const t = candles[idx].time;
      ticks.push({ label: formatAxisTime(t), x: x(idx) });
    }

    // Y-axis ticks.
    const yTicks: { label: string; y: number }[] = [];
    for (let k = 0; k <= 4; k++) {
      const p = min + (k / 4) * (max - min);
      yTicks.push({ label: formatPrice(p), y: y(p) });
    }

    const candleW = Math.max(1, Math.min(9, (width - WIDTH_PAD * 2) / n - 1));

    return {
      min, max, x, y, volScale, ticks, yTicks, candleW, priceBottom, volumeTop, volumeBottom,
    };
  }, [candles, width, height, bbUpper, bbLower, bbMid, ema20, ema50, sma50, levels]);

  if (!layout) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted">No chart data.</div>;
  }
  if (width < 40) {
    return <div ref={containerRef} style={{ height }} className="w-full" aria-hidden />;
  }

  const { x, y, candleW, priceBottom, volumeBottom, ticks, yTicks, volScale } = layout;
  const hoverCandle = hover != null ? candles[hover] : null;

  const linePath = (arr: (number | null)[] | undefined) => {
    if (!arr) return "";
    let d = "";
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v == null) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    }
    return d;
  };
  const bbPath = (arr: (number | null)[] | undefined) => {
    if (!arr) return "";
    let d = "";
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v == null) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    }
    return d;
  };

  const gridColor = "currentColor";

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Candlestick chart, ${candles.length} bars. Latest ${hoverCandle ? `open ${hoverCandle.open}, high ${hoverCandle.high}, low ${hoverCandle.low}, close ${hoverCandle.close}.` : "See hovered bar for details."
          }`}
        className="text-zinc-400 dark:text-zinc-600"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = ((e.clientX - rect.left) / rect.width) * width;
          let idx = Math.round(((cx - WIDTH_PAD) / (width - WIDTH_PAD * 2)) * (candles.length - 1));
          idx = Math.max(0, Math.min(candles.length - 1, idx));
          setHover(idx);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid + y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={WIDTH_PAD} x2={width - WIDTH_PAD} y1={t.y} y2={t.y} stroke={gridColor} strokeOpacity={0.15} strokeDasharray="3 3" />
            <text x={width - WIDTH_PAD - 2} y={t.y - 4} textAnchor="end" fontSize={10} fill="currentColor">
              {t.label}
            </text>
          </g>
        ))}
        {/* X labels update */}
        {ticks.map((t, i) => (
          <text key={i} x={t.x} y={priceBottom + 14} textAnchor="middle" fontSize={10} fill="currentColor">
            {t.label}
          </text>
        ))}

        {/* Bollinger bands */}
        {bbUpper && bbLower && (
          <>
            <path d={bbPath(bbUpper)} fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth={1} />
            <path d={bbPath(bbLower)} fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth={1} />
            {bbMid && <path d={bbPath(bbMid)} fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth={1} strokeDasharray="2 2" />}
          </>
        )}

        {/* EMA50 / SMA50 */}
        {sma50 && <path d={linePath(sma50)} fill="none" stroke="rgba(251,146,60,0.85)" strokeWidth={1.2} />}
        {ema50 && <path d={linePath(ema50)} fill="none" stroke="rgba(234,179,8,0.85)" strokeWidth={1} />}
        {/* EMA20 */}
        {ema20 && <path d={linePath(ema20)} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth={1.2} />}

        {/* Support/resistance lines */}
        {levels.map((l, k) => (
          <g key={k}>
            <line
              x1={WIDTH_PAD}
              x2={width - WIDTH_PAD}
              y1={y(l.level)}
              y2={y(l.level)}
              stroke={l.kind === "support" ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)"}
              strokeWidth={1}
              strokeDasharray="5 4"
            />
            <text x={WIDTH_PAD + 2} y={y(l.level) - 4} fontSize={9} fill={l.kind === "support" ? "#22c55e" : "#ef4444"}>
              {l.kind === "support" ? "S" : "R"} {formatPrice(l.level)}
            </text>
          </g>
        ))}

        {/* Candles + volume */}
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? "#22c55e" : "#ef4444";
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          const wickTop = y(c.high);
          const wickBottom = y(c.low);
          const vH = volScale(c.volume);
          return (
            <g key={c.time}>
              <rect x={x(i) - candleW / 2 + candleW / 4} y={wickTop} width={Math.max(1, candleW / 2)} height={Math.max(1, wickBottom - wickTop)} fill={color} opacity={0.7} />
              <rect x={x(i) - candleW / 2} y={bodyTop} width={candleW} height={Math.max(1, bodyBottom - bodyTop)} fill={color} />
              <rect x={x(i) - candleW / 2} y={layout.volumeTop + (volumeBottom - layout.volumeTop - vH)} width={candleW} height={vH} fill={up ? "#22c55e" : "#ef4444"} opacity={0.35} />
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={8} y2={volumeBottom} stroke="rgba(120,120,120,0.4)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(candles[hover].close)} r={3} fill="#6366f1" />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoverCandle && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{
            left: Math.min(width - 170, x(hover) + 10),
          }}
        >
          <div className="mb-1 font-semibold">{new Date(hoverCandle.time).toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
            <span>Open</span><span className="font-medium text-foreground">{formatPrice(hoverCandle.open)}</span>
            <span>High</span><span className="font-medium text-foreground">{formatPrice(hoverCandle.high)}</span>
            <span>Low</span><span className="font-medium text-foreground">{formatPrice(hoverCandle.low)}</span>
            <span>Close</span><span className="font-medium text-foreground">{formatPrice(hoverCandle.close)}</span>
            <span>Vol</span><span className="font-medium text-foreground">{formatCompact(hoverCandle.volume)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAxisTime(ms: number): string {
  const d = new Date(ms);
  const sameDay = new Date().getDate() === d.getDate();
  if (sameDay) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getDate()}/${d.getMonth() + 1}`;
}