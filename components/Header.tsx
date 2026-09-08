"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "@/hooks/useTheme";

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

const NAV_LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#signals", label: "Signals" },
  { href: "#risk", label: "Risk & Levels" },
  { href: "#timeframes", label: "Timeframes" },
  { href: "#methodology", label: "Methodology" },
];

export function ThemeToggle() {
  const { theme, setTheme, resolved } = useTheme();
  const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2];

  return (
    <>
      {/* Phones: one finger-sized button that cycles, to save header width. */}
      <button
        type="button"
        onClick={() => setTheme(THEME_OPTIONS[(THEME_OPTIONS.indexOf(current) + 1) % THEME_OPTIONS.length].value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-elevated text-base text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        title={`Theme: ${current.label}${theme === "system" ? ` (${resolved})` : ""} — tap to change`}
      >
        <span aria-hidden>{current.icon}</span>
        <span className="sr-only">Change color theme (currently {current.label})</span>
      </button>

      {/* Tablet and up: the explicit three-way choice. */}
      <div
        className="hidden items-center gap-0.5 rounded-full border border-border bg-elevated p-0.5 sm:inline-flex"
        role="group"
        aria-label="Color theme"
      >
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-pressed={theme === o.value}
            title={`${o.label} theme${o.value === "system" ? ` (currently ${resolved})` : ""}`}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              theme === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden>{o.icon}</span>
            <span className="sr-only">{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3.5 sm:h-16 sm:px-6">
        <a
          href="#overview"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-base font-bold text-white shadow"
            aria-hidden
          >
            ⌁
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-foreground">CryptoPro</span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-primary sm:text-[11px]">
              Analyzer
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex" aria-label="Main">
          {NAV_LINKS.slice(1).map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-elevated text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <span aria-hidden className="text-base leading-none">
              {open ? "✕" : "☰"}
            </span>
            <span className="sr-only">{open ? "Close" : "Open"} section menu</span>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          className="animate-fade-in border-t border-border bg-surface px-3.5 pb-3 pt-1 shadow-lg md:hidden"
        >
          <nav aria-label="Sections" className="grid gap-0.5">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
