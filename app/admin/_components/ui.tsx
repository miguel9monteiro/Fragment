// Small shared UI primitives for the cockpit. Kept in one file so a single
// styling tweak (e.g. card padding, badge tone) propagates everywhere.

import { cn } from '@/lib/utils';

export function Section({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

// Severity-tone helper. Maps the alert level (info | warn | error | critical)
// and the special "ok" + "muted" pseudo-levels to a consistent Tailwind tone.
// Light + dark-mode pairs are explicit so the borders stay readable in both
// schemes; we don't rely on opacity which can drop contrast below WCAG AA.
const TONES = {
  ok:       'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/60',
  info:     'bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/60',
  warn:     'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/60',
  error:    'bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900/60',
  critical: 'bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900/60',
  muted:    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
} as const;

export type Tone = keyof typeof TONES;

export function Pill({
  tone = 'muted',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-GB');
}

export function formatPercent(num: number, denom: number): string {
  if (!denom) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}
