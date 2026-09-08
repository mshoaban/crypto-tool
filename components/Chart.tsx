"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatCompact, formatPercent, formatPrice } from "@/lib/format";
import type { Candle, SupportResistance } from "@/lib/types";
import { IconButton } from "./ui";

interface ChartProps {
  candles: Candle[];
  ema20?: (number | null)[];
  ema50?: (number | null)[];
  sma50?: (number | null)[];
  bbUpper?: (number | null)[];
  bbLower?: (number | null)[];
  bbMid?: (number | null)[];
  levels?: SupportResistance[];
  /** Changing this resets zoom + pan. Pass `${symbol}:${interval}`. */
  resetKey?: string;
  /** Timeframe label, used in the accessible description. */
  timeframeLabel?: string;
}

/** Visible window in (fractional) candle-index space. */
interface View {
  start: number;
  end: number;
}

const MIN_VISIBLE_BARS = 12;
const PAD_LEFT = 8;
const PAD_TOP = 12;
const AXIS_H = 20; // bottom time-axis strip
const PANE_GAP = 8;
const VOLUME_FRACTION = 0.17;
const ZOOM_STEP = 1.6;

interface ChartPalette {
  bull: string;
  bear: string;
  bullSoft: string;
  bearSoft: string;
  series1: string;
  series2: string;
  series3: string;
  grid: string;
  axis: string;
  crosshair: string;
  tag: string;
  tagForeground: string;
  surface: string;
  primary: string;
}

const LIGHT_CHART = {
  bull: "#0e9f4f",
  bear: "#d03b3b",
  bullSoft: "rgba(14, 159, 79, 0.34)",
  bearSoft: "rgba(208, 59, 59, 0.34)",
  series1: "#2a78d6",
  series2: "#b45309",
  series3: "#6d28d9",
  grid: "rgba(11, 11, 11, 0.1)",
  axis: "#6b7280",
  crosshair: "rgba(11, 11, 11, 0.45)",
  tag: "#16181d",
  tagForeground: "#ffffff",
  surface: "#ffffff",
  primary: "#4f46e5",
} satisfies ChartPalette;

const DARK_CHART = {
  bull: "#2fb968",
  bear: "#e66767",
  bullSoft: "rgba(47, 185, 104, 0.38)",
  bearSoft: "rgba(230, 103, 103, 0.38)",
  series1: "#5598e7",
  series2: "#eda100",
  series3: "#9085e9",
  grid: "rgba(255, 255, 255, 0.09)",
  axis: "#9aa4b5",
  crosshair: "rgba(255, 255, 255, 0.45)",
  tag: "#eceef3",
  tagForeground: "#0a0c11",
  surface: "#12151c",
  primary: "#6b66f1",
} satisfies ChartPalette;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function axisTime(ms: number, spanMs: number): string {
  const d = new Date(ms);
  const two = (v: number) => String(v).padStart(2, "0");
  if (spanMs <= 2 * 86_400_000) return `${two(d.getHours())}:${two(d.getMinutes())}`;
  if (spanMs <= 200 * 86_400_000) return `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
  return `${d.toLocaleString(undefined, { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
}

export default function Chart({
  candles,
  ema20,
  ema50,
  sma50,
  bbUpper,
  bbLower,
  bbMid,
  levels = [],
  resetKey = "",
  timeframeLabel = "",
}: ChartProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** null = the whole series is visible (and new bars are followed). */
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ index: number; y: number } | null>(null);
  const [finePointer, setFinePointer] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [darkTheme, setDarkTheme] = useState(false);
  const palette = darkTheme ? DARK_CHART : LIGHT_CHART;
  const n = candles.length;

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
      }
    });
    ro.observe(el);
    setSize({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  // Floating tooltips only make sense where there is a hovering cursor.
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setDarkTheme(root.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setFinePointer(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // A different symbol/timeframe is a different series: start fully zoomed out.
  useEffect(() => {
    setView(null);
    setHover(null);
  }, [resetKey]);

  // Auto-refresh appends bars. Keep following the live edge if the user is
  // parked there, otherwise hold the window they chose.
  const prevLen = useRef(n);
  useEffect(() => {
    const prev = prevLen.current;
    prevLen.current = n;
    if (prev === n || n < 2) return;
    setView((v) => {
      if (!v) return null;
      const span = Math.min(v.end - v.start, n - 1);
      const maxStart = Math.max(0, n - 1 - span);
      const start = v.end >= prev - 1.5 ? maxStart : clamp(v.start, 0, maxStart);
      return { start, end: start + span };
    });
  }, [n]);

  const geom = useMemo(() => {
    if (n < 2 || size.w < 80 || size.h < 120) return null;
    const compact = size.w < 520;
    const padRight = compact ? 48 : 64;
    const plotW = Math.max(24, size.w - PAD_LEFT - padRight);
    const maxSpan = n - 1;
    const minSpan = Math.min(maxSpan, MIN_VISIBLE_BARS - 1);
    const requested = view ?? { start: 0, end: maxSpan };
    const span = clamp(requested.end - requested.start, minSpan, maxSpan);
    const start = clamp(requested.start, 0, maxSpan - span);
    const end = start + span;
    const i0 = Math.max(0, Math.floor(start));
    const i1 = Math.min(maxSpan, Math.ceil(end));

    // Price scale covers only what is on screen, so zooming in actually
    // magnifies the price action instead of just widening the bars.
    let min = Infinity;
    let max = -Infinity;
    for (let i = i0; i <= i1; i++) {
      const c = candles[i];
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    for (const overlay of [bbUpper, bbLower, bbMid, ema20, ema50, sma50]) {
      if (!overlay) continue;
      for (let i = i0; i <= i1 && i < overlay.length; i++) {
        const v = overlay[i];
        if (v == null || !Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (max === min) {
      const bump = Math.abs(max) * 0.01 || 1;
      min -= bump;
      max += bump;
    }
    const pricePad = (max - min) * 0.08;
    min -= pricePad;
    max += pricePad;

    const volumeH = Math.max(22, Math.round((size.h - PAD_TOP - AXIS_H) * VOLUME_FRACTION));
    const priceH = Math.max(60, size.h - PAD_TOP - AXIS_H - volumeH - PANE_GAP);
    const priceTop = PAD_TOP;
    const priceBottom = priceTop + priceH;
    const volumeTop = priceBottom + PANE_GAP;
    const volumeBottom = volumeTop + volumeH;

    const x = (i: number) => PAD_LEFT + ((i - start) / span) * plotW;
    const y = (p: number) => priceTop + (1 - (p - min) / (max - min)) * priceH;
    const priceAtY = (py: number) => min + (1 - (py - priceTop) / priceH) * (max - min);
    const indexAtX = (px: number) => clamp(Math.round(start + ((px - PAD_LEFT) / plotW) * span), 0, maxSpan);

    let volMax = 0;
    for (let i = i0; i <= i1; i++) if (candles[i].volume > volMax) volMax = candles[i].volume;
    const volumeHeight = (v: number) => (volMax <= 0 ? 0 : (v / volMax) * volumeH);

    const barW = clamp(plotW / (span + 1), 1, 16);
    const bodyW = barW <= 2 ? barW : barW - 1;
    const wickW = clamp(bodyW * 0.18, 0.75, 1.6);

    const spanMs = candles[i1].time - candles[i0].time;
    const tickCount = compact ? 4 : 6;
    const ticks: { label: string; x: number }[] = [];
    for (let k = 0; k < tickCount; k++) {
      const idx = clamp(Math.round(start + (k / (tickCount - 1)) * span), 0, maxSpan);
      ticks.push({ label: axisTime(candles[idx].time, spanMs), x: x(idx) });
    }
    const yTickCount = size.h < 320 ? 3 : 4;
    const yTicks: { label: string; y: number }[] = [];
    for (let k = 0; k <= yTickCount; k++) {
      const p = min + (k / yTickCount) * (max - min);
      yTicks.push({ label: formatPrice(p), y: y(p) });
    }

    return {
      compact, padRight, plotW, start, end, span, minSpan, maxSpan, i0, i1, min, max,
      x, y, priceAtY, indexAtX, volumeHeight, barW, bodyW, wickW,
      ticks, yTicks, priceTop, priceBottom, volumeTop, volumeBottom,
      width: size.w, height: size.h,
    };
  }, [candles, n, size.w, size.h, view, bbUpper, bbLower, bbMid, ema20, ema50, sma50]);

  const geomRef = useRef(geom);
  useEffect(() => {
    geomRef.current = geom;
  }, [geom]);

  const zoomBy = useCallback(
    (factor: number, anchorFrac = 0.5) => {
      setView((prev) => {
        const maxSpan = n - 1;
        if (maxSpan < 1) return prev;
        const minSpan = Math.min(maxSpan, MIN_VISIBLE_BARS - 1);
        const cur = prev ?? { start: 0, end: maxSpan };
        const span = clamp(cur.end - cur.start, minSpan, maxSpan);
        const nextSpan = clamp(span / factor, minSpan, maxSpan);
        if (nextSpan >= maxSpan) return null; // back to the full series
        const anchor = cur.start + anchorFrac * span;
        const start = clamp(anchor - anchorFrac * nextSpan, 0, maxSpan - nextSpan);
        return { start, end: start + nextSpan };
      });
    },
    [n],
  );

  const panByBars = useCallback(
    (bars: number) => {
      setView((prev) => {
        const maxSpan = n - 1;
        if (maxSpan < 1) return prev;
        const minSpan = Math.min(maxSpan, MIN_VISIBLE_BARS - 1);
        const cur = prev ?? { start: 0, end: maxSpan };
        const span = clamp(cur.end - cur.start, minSpan, maxSpan);
        if (span >= maxSpan) return prev; // nothing to pan while fully zoomed out
        const start = clamp(cur.start + bars, 0, maxSpan - span);
        return { start, end: start + span };
      });
    },
    [n],
  );

  const centerOn = useCallback(
    (indexCenter: number) => {
      setView((prev) => {
        const maxSpan = n - 1;
        if (maxSpan < 1) return prev;
        const minSpan = Math.min(maxSpan, MIN_VISIBLE_BARS - 1);
        const cur = prev ?? { start: 0, end: maxSpan };
        const span = clamp(cur.end - cur.start, minSpan, maxSpan);
        if (span >= maxSpan) return prev;
        const start = clamp(indexCenter - span / 2, 0, maxSpan - span);
        return { start, end: start + span };
      });
    },
    [n],
  );

  const resetView = useCallback(() => setView(null), []);

  // Ctrl/⌘ + wheel zooms (this is also what a trackpad pinch sends); Shift +
  // wheel pans. A bare wheel is left to the page so the chart never hijacks
  // scrolling.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const g = geomRef.current;
      if (!g) return;
      const zoomGesture = e.ctrlKey || e.metaKey;
      if (!zoomGesture && !e.shiftKey) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      if (zoomGesture) {
        const rect = el.getBoundingClientRect();
        const frac = clamp((e.clientX - rect.left - PAD_LEFT) / g.plotW, 0, 1);
        zoomBy(clamp(Math.exp((-e.deltaY * unit) / 400), 0.5, 2), frac);
      } else {
        const delta = (e.deltaX || e.deltaY) * unit;
        panByBars((delta / g.plotW) * g.span);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, panByBars]);

  // --- Pointer gestures: 1 finger / mouse drag pans, 2 fingers pinch-zoom ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    mode: "pan" | "pinch";
    startView: View;
    startSpan: number;
    startX: number;
    startDist: number;
    anchorFrac: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = geom;
    if (!g) return;
    const el = e.currentTarget;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (el.setPointerCapture) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
    }
    const startView = { start: g.start, end: g.end };
    if (pointers.current.size === 1) {
      drag.current = { mode: "pan", startView, startSpan: g.span, startX: e.clientX, startDist: 0, anchorFrac: 0, moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = el.getBoundingClientRect();
      const centerX = (a.x + b.x) / 2 - rect.left;
      drag.current = {
        mode: "pinch",
        startView,
        startSpan: g.span,
        startX: centerX,
        startDist: Math.max(1, Math.abs(a.x - b.x)),
        anchorFrac: clamp((centerX - PAD_LEFT) / g.plotW, 0, 1),
        moved: true,
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = geom;
    if (!g) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (pointers.current.size === 0) {
      if (e.pointerType !== "touch") {
        setHover({ index: g.indexAtX(e.clientX - rect.left), y: e.clientY - rect.top });
      }
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;

    if (d.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.max(1, Math.abs(a.x - b.x));
      const factor = clamp(dist / d.startDist, 0.05, 20);
      const maxSpan = n - 1;
      const minSpan = Math.min(maxSpan, MIN_VISIBLE_BARS - 1);
      const nextSpan = clamp(d.startSpan / factor, minSpan, maxSpan);
      if (nextSpan >= maxSpan) {
        setView(null);
        return;
      }
      const anchor = d.startView.start + d.anchorFrac * d.startSpan;
      const start = clamp(anchor - d.anchorFrac * nextSpan, 0, maxSpan - nextSpan);
      setView({ start, end: start + nextSpan });
      return;
    }

    if (d.mode === "pan") {
      const dx = e.clientX - d.startX;
      if (Math.abs(dx) > 5) d.moved = true;
      if (d.startSpan < n - 1) {
        const bars = -(dx / g.plotW) * d.startSpan;
        const start = clamp(d.startView.start + bars, 0, n - 1 - d.startSpan);
        setView({ start, end: start + d.startSpan });
      }
      if (e.pointerType !== "touch") {
        setHover({ index: g.indexAtX(e.clientX - rect.left), y: e.clientY - rect.top });
      }
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = geom;
    const wasTap = drag.current?.mode === "pan" && !drag.current.moved;
    pointers.current.delete(e.pointerId);
    const el = e.currentTarget;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (pointers.current.size === 0) {
      drag.current = null;
      // A tap (no drag) parks the crosshair — the only way to read a bar on touch.
      if (wasTap && g) {
        const rect = el.getBoundingClientRect();
        setHover({ index: g.indexAtX(e.clientX - rect.left), y: e.clientY - rect.top });
      }
    } else if (pointers.current.size === 1 && g) {
      // Lifting one finger out of a pinch continues as a pan.
      const [remaining] = [...pointers.current.values()];
      drag.current = {
        mode: "pan",
        startView: { start: g.start, end: g.end },
        startSpan: g.span,
        startX: remaining.x,
        startDist: 0,
        anchorFrac: 0,
        moved: true,
      };
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const g = geom;
    if (!g) return;
    const step = Math.max(1, (e.shiftKey ? 0.3 : 0.1) * g.span);
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        panByBars(-step);
        break;
      case "ArrowRight":
        e.preventDefault();
        panByBars(step);
        break;
      case "ArrowUp":
      case "+":
      case "=":
        e.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "ArrowDown":
      case "-":
      case "_":
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
        break;
      case "Home":
      case "0":
        e.preventDefault();
        resetView();
        break;
      case "Escape":
        setHover(null);
        break;
      default:
        break;
    }
  };

  // Overview strip: full series, with the visible window shown as a shuttle.
  const overviewPath = useMemo(() => {
    if (n < 2) return "";
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of candles) {
      if (c.close < lo) lo = c.close;
      if (c.close > hi) hi = c.close;
    }
    const range = hi - lo || 1;
    const stride = Math.max(1, Math.floor(n / 160));
    let d = "";
    for (let i = 0; i < n; i += stride) {
      d += `${d ? "L" : "M"}${((i / (n - 1)) * 100).toFixed(2)},${(100 - ((candles[i].close - lo) / range) * 100).toFixed(2)}`;
    }
    return `${d}L100,${(100 - ((candles[n - 1].close - lo) / range) * 100).toFixed(2)}`;
  }, [candles, n]);

  const scrubbing = useRef(false);
  const scrubTo = useCallback(
    (clientX: number) => {
      const el = overviewRef.current;
      if (!el || n < 2) return;
      const rect = el.getBoundingClientRect();
      centerOn(clamp((clientX - rect.left) / rect.width, 0, 1) * (n - 1));
    },
    [centerOn, n],
  );

  const activeIndex = hover ? clamp(hover.index, 0, Math.max(0, n - 1)) : n - 1;
  const activeCandle: Candle | undefined = candles[activeIndex];
  const visibleBars = geom ? Math.round(geom.span) + 1 : n;
  const isZoomed = view !== null;
  const canZoomIn = !geom || geom.span > geom.minSpan + 0.01;

  const seriesValue = (arr: (number | null)[] | undefined) => {
    const v = arr?.[activeIndex];
    return v == null || !Number.isFinite(v) ? null : v;
  };

  const legend = [
    ema20 ? { label: "EMA 20", color: palette.series1, value: seriesValue(ema20), dashed: false } : null,
    ema50 ? { label: "EMA 50", color: palette.series2, value: seriesValue(ema50), dashed: false } : null,
    bbUpper ? { label: "Bollinger", color: palette.series3, value: seriesValue(bbUpper), dashed: true } : null,
  ].filter((s): s is { label: string; color: string; value: number | null; dashed: boolean } => s !== null);

  const overlayPath = (arr: (number | null)[] | undefined) => {
    if (!arr || !geom) return "";
    const from = Math.max(0, geom.i0 - 1);
    const to = Math.min(n - 1, geom.i1 + 1);
    let d = "";
    let open = false;
    for (let i = from; i <= to && i < arr.length; i++) {
      const v = arr[i];
      if (v == null || !Number.isFinite(v)) {
        open = false;
        continue;
      }
      d += `${open ? "L" : "M"}${geom.x(i).toFixed(1)},${geom.y(v).toFixed(1)} `;
      open = true;
    }
    return d;
  };

  if (n === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No candles available for this timeframe.
      </div>
    );
  }

  const visible = geom ? candles.slice(geom.i0, geom.i1 + 1) : [];
  const hoverX = geom && hover ? geom.x(activeIndex) : 0;
  const hoverPrice = geom && hover ? geom.priceAtY(clamp(hover.y, geom.priceTop, geom.priceBottom)) : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Readout: OHLC of the hovered bar (or the latest one) — always visible,
          so touch users never depend on a floating tooltip. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-elevated px-2.5 py-2 text-[11px] sm:text-xs">
        <span className="font-medium text-muted-foreground">
          {activeCandle ? new Date(activeCandle.time).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        {activeCandle && (
          <>
            <OhlcValue label="O" value={activeCandle.open} />
            <OhlcValue label="H" value={activeCandle.high} />
            <OhlcValue label="L" value={activeCandle.low} />
            <OhlcValue label="C" value={activeCandle.close} />
            <span
              className={`font-semibold tabular-nums ${
                activeCandle.close >= activeCandle.open ? "text-bull" : "text-bear"
              }`}
            >
              {formatPercent(((activeCandle.close - activeCandle.open) / (activeCandle.open || 1)) * 100)}
            </span>
            <span className="tabular-nums text-muted-foreground">Vol {formatCompact(activeCandle.volume)}</span>
          </>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          {hover ? "selected bar" : "latest bar"}
        </span>
      </div>

      {/* Legend doubles as the per-series value readout, so identity is never
          carried by colour alone. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded-full"
                style={
                  s.dashed
                    ? { backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 3px, transparent 3px 6px)` }
                    : { backgroundColor: s.color }
                }
              />
              {s.label}
              {s.value != null && <span className="font-medium tabular-nums text-foreground">{formatPrice(s.value)}</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline" aria-hidden>
            {visibleBars}/{n} bars
          </span>
          <IconButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={!isZoomed}>
            <span aria-hidden>−</span>
          </IconButton>
          <IconButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={!canZoomIn}>
            <span aria-hidden>+</span>
          </IconButton>
          <IconButton label="Reset zoom" onClick={resetView} disabled={!isZoomed}>
            <span aria-hidden>⤢</span>
          </IconButton>
        </div>
      </div>

      <div
        ref={surfaceRef}
        tabIndex={0}
        role="group"
        aria-label={`Price chart${timeframeLabel ? ` (${timeframeLabel})` : ""}. Showing ${visibleBars} of ${n} bars. Arrow keys pan, plus and minus zoom, Home resets.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => {
          if (pointers.current.size === 0) setHover(null);
        }}
        onDoubleClick={(e) => {
          const g = geom;
          if (!g) return;
          const rect = e.currentTarget.getBoundingClientRect();
          zoomBy(2, clamp((e.clientX - rect.left - PAD_LEFT) / g.plotW, 0, 1));
        }}
        className="relative h-[280px] w-full touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[360px] lg:h-[440px]"
        style={{ cursor: isZoomed ? "grab" : "crosshair" }}
      >
        {geom && (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${geom.width} ${geom.height}`}
            preserveAspectRatio="none"
            className="block h-full w-full"
            role="img"
            aria-label={`Candlestick chart with volume. ${visibleBars} bars from ${new Date(candles[geom.i0].time).toLocaleString()} to ${new Date(candles[geom.i1].time).toLocaleString()}.`}
          >
            <defs>
              <clipPath id={`plot-${clipId}`}>
                <rect x={0} y={0} width={PAD_LEFT + geom.plotW + 1} height={geom.volumeBottom + 1} />
              </clipPath>
            </defs>

            {/* Recessive grid + price scale in the right gutter. */}
            {geom.yTicks.map((t, i) => (
              <g key={`y${i}`}>
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + geom.plotW}
                  y1={t.y}
                  y2={t.y}
                  stroke={palette.grid}
                  strokeWidth={1}
                />
                <text
                  x={geom.width - 4}
                  y={t.y + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill={palette.axis}
                  className="tabular-nums"
                >
                  {t.label}
                </text>
              </g>
            ))}
            {geom.ticks.map((t, i) => (
              <text
                key={`x${i}`}
                x={clamp(t.x, 14, PAD_LEFT + geom.plotW - 14)}
                y={geom.volumeBottom + 14}
                textAnchor="middle"
                fontSize={10}
                fill={palette.axis}
              >
                {t.label}
              </text>
            ))}

            <g clipPath={`url(#plot-${clipId})`}>
              {/* Bollinger envelope */}
              {bbUpper && bbLower && (
                <>
                  <path d={overlayPath(bbUpper)} fill="none" stroke={palette.series3} strokeWidth={1} strokeOpacity={0.7} />
                  <path d={overlayPath(bbLower)} fill="none" stroke={palette.series3} strokeWidth={1} strokeOpacity={0.7} />
                  {bbMid && (
                    <path
                      d={overlayPath(bbMid)}
                      fill="none"
                      stroke={palette.series3}
                      strokeWidth={1}
                      strokeOpacity={0.55}
                      strokeDasharray="3 3"
                    />
                  )}
                </>
              )}

              {/* Support / resistance inside the visible price range */}
              {levels
                .filter((l) => l.level >= geom.min && l.level <= geom.max)
                .map((l, k) => (
                  <g key={`lvl${k}`}>
                    <line
                      x1={PAD_LEFT}
                      x2={PAD_LEFT + geom.plotW}
                      y1={geom.y(l.level)}
                      y2={geom.y(l.level)}
                      stroke={l.kind === "support" ? palette.bull : palette.bear}
                      strokeWidth={1}
                      strokeOpacity={0.65}
                      strokeDasharray="5 4"
                    />
                    <text
                      x={PAD_LEFT + 3}
                      y={geom.y(l.level) - 4}
                      fontSize={9}
                      fill={l.kind === "support" ? palette.bull : palette.bear}
                    >
                      {l.kind === "support" ? "S" : "R"} {formatPrice(l.level)}
                    </text>
                  </g>
                ))}

              {/* Candles + volume. Up bars are hollow so direction survives
                  colour-vision deficiency and greyscale printing. */}
              {visible.map((c, k) => {
                const i = geom.i0 + k;
                const up = c.close >= c.open;
                const color = up ? palette.bull : palette.bear;
                const cx = geom.x(i);
                const openY = geom.y(c.open);
                const closeY = geom.y(c.close);
                const bodyTop = Math.min(openY, closeY);
                const bodyH = Math.max(1, Math.abs(closeY - openY));
                const hollow = up && geom.bodyW >= 3.5;
                const vh = geom.volumeHeight(c.volume);
                return (
                  <g key={c.time}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={geom.y(c.high)}
                      y2={geom.y(c.low)}
                      stroke={color}
                      strokeWidth={geom.wickW}
                    />
                    <rect
                      x={cx - geom.bodyW / 2}
                      y={bodyTop}
                      width={geom.bodyW}
                      height={bodyH}
                      fill={hollow ? palette.surface : color}
                      stroke={color}
                      strokeWidth={hollow ? 1 : 0}
                    />
                    <rect
                      x={cx - geom.bodyW / 2}
                      y={geom.volumeBottom - vh}
                      width={geom.bodyW}
                      height={vh}
                      fill={up ? palette.bullSoft : palette.bearSoft}
                    />
                  </g>
                );
              })}

              {/* Moving averages last so they stay readable over the bars. */}
              {sma50 && <path d={overlayPath(sma50)} fill="none" stroke={palette.series2} strokeWidth={1.5} strokeOpacity={0.65} strokeDasharray="4 3" />}
              {ema50 && <path d={overlayPath(ema50)} fill="none" stroke={palette.series2} strokeWidth={1.75} />}
              {ema20 && <path d={overlayPath(ema20)} fill="none" stroke={palette.series1} strokeWidth={1.75} />}
            </g>

            {/* Crosshair — only while the selected bar is inside the window. */}
            {hover && activeCandle && activeIndex >= geom.i0 && activeIndex <= geom.i1 && (
              <g pointerEvents="none">
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={geom.priceTop}
                  y2={geom.volumeBottom}
                  stroke={palette.crosshair}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + geom.plotW}
                  y1={clamp(hover.y, geom.priceTop, geom.priceBottom)}
                  y2={clamp(hover.y, geom.priceTop, geom.priceBottom)}
                  stroke={palette.crosshair}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={hoverX} cy={geom.y(activeCandle.close)} r={3.5} fill={palette.primary} stroke={palette.surface} strokeWidth={1.5} />
                {/* price tag on the scale */}
                <g transform={`translate(${PAD_LEFT + geom.plotW + 2}, ${clamp(hover.y, geom.priceTop, geom.priceBottom)})`}>
                  <rect x={0} y={-8} width={geom.padRight - 6} height={16} rx={3} fill={palette.tag} />
                  <text x={(geom.padRight - 6) / 2} y={4} textAnchor="middle" fontSize={9.5} fill={palette.tagForeground} className="tabular-nums">
                    {formatPrice(hoverPrice)}
                  </text>
                </g>
              </g>
            )}
          </svg>
        )}

        {/* Floating tooltip: pointer devices only (touch reads the row above). */}
        {finePointer && hover && activeCandle && geom && activeIndex >= geom.i0 && activeIndex <= geom.i1 && (
          <div
            className="pointer-events-none absolute z-10 w-40 rounded-lg border border-border bg-surface/95 p-2 text-[11px] shadow-lg backdrop-blur"
            style={{
              left: clamp(hoverX + 12, 4, Math.max(4, geom.width - 168)),
              top: clamp(hover.y + 12, 4, Math.max(4, geom.height - 132)),
            }}
          >
            <div className="mb-1 font-semibold text-foreground">{new Date(activeCandle.time).toLocaleString()}</div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
              <dt>Open</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatPrice(activeCandle.open)}</dd>
              <dt>High</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatPrice(activeCandle.high)}</dd>
              <dt>Low</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatPrice(activeCandle.low)}</dd>
              <dt>Close</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatPrice(activeCandle.close)}</dd>
              <dt>Volume</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatCompact(activeCandle.volume)}</dd>
            </dl>
          </div>
        )}
      </div>

      {/* Zoom shuttle: shows where the visible window sits in the series and
          drags it around — the discoverable zoom affordance on touch. */}
      <div
        ref={overviewRef}
        onPointerDown={(e) => {
          if (!isZoomed) return;
          scrubbing.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (scrubbing.current) scrubTo(e.clientX);
        }}
        onPointerUp={(e) => {
          scrubbing.current = false;
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        className={`relative h-9 w-full overflow-hidden rounded-lg border border-border bg-elevated ${
          isZoomed ? "cursor-grab touch-none" : "cursor-default"
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={overviewPath} fill="none" stroke={palette.axis} strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
        {geom && (
          <div
            className="absolute inset-y-0 border-x-2 border-primary bg-primary/15"
            style={{
              left: `${(geom.start / geom.maxSpan) * 100}%`,
              width: `${Math.max(1.5, (geom.span / geom.maxSpan) * 100)}%`,
            }}
          />
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Zoom:</span> pinch, ⌘/Ctrl + scroll, double-click, or the ± buttons.{" "}
        <span className="font-medium text-foreground">Pan:</span> drag, Shift + scroll, or ← → when focused. Tap a bar for its values.
      </p>

      <details className="group rounded-xl border border-border bg-elevated">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ▸
          </span>
          Data table — visible bars
        </summary>
        <div className="max-h-64 overflow-auto border-t border-border">
          <table className="w-full min-w-[420px] text-left text-[11px]">
            <caption className="sr-only">
              Open, high, low, close and volume for the {visibleBars} bars currently visible on the chart.
            </caption>
            <thead className="sticky top-0 bg-elevated text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Time</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Open</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">High</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Low</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Close</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Volume</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {tableRows(visible).map((c) => (
                <tr key={c.time} className="border-t border-border/60">
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {new Date(c.time).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5 text-right">{formatPrice(c.open)}</td>
                  <td className="px-2 py-1.5 text-right">{formatPrice(c.high)}</td>
                  <td className="px-2 py-1.5 text-right">{formatPrice(c.low)}</td>
                  <td className={`px-2 py-1.5 text-right font-medium ${c.close >= c.open ? "text-bull" : "text-bear"}`}>
                    {formatPrice(c.close)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{formatCompact(c.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function OhlcValue({ label, value }: { label: string; value: number }) {
  return (
    <span className="tabular-nums text-muted-foreground">
      {label} <span className="font-medium text-foreground">{formatPrice(value)}</span>
    </span>
  );
}

/** Cap the table at a readable size, keeping the newest bars. */
function tableRows(visible: Candle[]): Candle[] {
  const MAX = 60;
  return visible.length <= MAX ? visible : visible.slice(visible.length - MAX);
}
