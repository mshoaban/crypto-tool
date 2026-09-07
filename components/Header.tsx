"use client";

import { useTheme, type Theme } from "@/hooks/useTheme";

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

export function ThemeToggle() {
  const { theme, setTheme, resolved } = useTheme();
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-elevated p-0.5"
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
          className={`rounded-full px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            theme === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span aria-hidden>{o.icon}</span>
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#overview" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-base font-bold text-white shadow"
            aria-hidden
          >
            ⌁
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-foreground">CryptoPro</span>
            <span className="block text-[11px] font-medium uppercase tracking-widest text-primary">Analyzer</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex" aria-label="Main">
          <a href="#signals" className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground">Signals</a>
          <a href="#risk" className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground">Risk &amp; Levels</a>
          <a href="#timeframes" className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground">Timeframes</a>
          <a href="#methodology" className="rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground">Methodology</a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}