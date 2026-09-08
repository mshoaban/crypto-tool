// Small shared UI primitives.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-border bg-surface p-3.5 shadow-sm sm:p-5 ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "bull" | "bear" | "info" | "warn";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    bull: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    bear: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60",
  secondary:
    "border border-border bg-elevated text-foreground hover:bg-muted disabled:opacity-60",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60",
};

const BUTTON_SIZES = {
  md: "min-h-11 px-3.5 text-sm sm:min-h-10",
  sm: "min-h-9 px-3 text-xs",
} as const;

/**
 * Action button. `loading` swaps in a spinner and blocks repeat submits so a
 * user always gets visible feedback for the action they just took.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
        BUTTON_SIZES[size]
      } ${BUTTON_VARIANTS[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Square icon-only button with a finger-sized hit area. */
export function IconButton({
  children,
  label,
  className = "",
  ...rest
}: { children: ReactNode; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-elevated text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/** Accessible on/off switch — replaces the tiny checkbox on touch screens. */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  pendingValue = null,
  disabled = false,
  fill = false,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  /** Option whose data is currently being fetched. */
  pendingValue?: T | null;
  disabled?: boolean;
  /** Stretch to fill the row (mobile-friendly equal columns). */
  fill?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`rounded-full border border-border bg-elevated p-1 ${
        fill ? "grid w-full auto-cols-fr grid-flow-col sm:inline-flex sm:w-auto" : "inline-flex flex-wrap items-center gap-1"
      }`}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const pending = o.value === pendingValue;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            aria-busy={pending || undefined}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-9 ${
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {pending && <Spinner className="h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "bull" | "bear" | "neutral";
}) {
  const color =
    tone === "bull"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bear"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground sm:text-xs">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums sm:text-lg ${color}`}>{value}</dd>
      {hint && <dd className="text-[11px] leading-snug text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`shrink-0 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden />;
}

/**
 * Indeterminate bar pinned under the sticky header. Shown for the whole
 * lifetime of a user-triggered fetch.
 */
export function TopProgress({ active }: { active: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      {active && <div className="h-full w-full animate-progress bg-primary" />}
    </div>
  );
}

/**
 * Veil drawn over stale content while the next payload is in flight. Content
 * underneath stays readable (dimmed, not replaced) so the page never jumps.
 */
export function BusyOverlay({ active, label = "Loading…" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div
      className="absolute inset-0 z-20 flex animate-fade-in items-center justify-center rounded-2xl bg-surface/55 backdrop-blur-[2px]"
      aria-hidden
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg">
        <Spinner className="h-3.5 w-3.5 text-primary" />
        {label}
      </span>
    </div>
  );
}

/** Polite live region: announces action progress to assistive tech. */
export function LiveStatus({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/** Horizontal scroller for chip rows and wide tables on narrow screens. */
export function ScrollRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`no-scrollbar -mx-3.5 overflow-x-auto px-3.5 sm:mx-0 sm:px-0 ${className}`}>
      {children}
    </div>
  );
}
