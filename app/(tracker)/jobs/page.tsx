import Link from 'next/link';

import { BackButton } from '@/tracker/components/BackButton';
import { SyncButton } from '@/tracker/components/SyncButton';
import { getSupabaseServerClient } from '@/tracker/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PER_PAGE = 50;

const CATEGORY_LABELS: Record<string, string> = {
  investment_banking: 'Investment Banking',
  sales_trading: 'Sales & Trading',
  research: 'Research',
  asset_management: 'Asset Management',
  wealth_management: 'Wealth Management',
  private_equity: 'Private Equity',
  private_credit: 'Private Credit',
  hedge_fund: 'Hedge Fund',
  quant: 'Quant',
  risk_compliance: 'Risk & Compliance',
  technology: 'Technology',
  corporate_functions: 'Corporate Functions',
  risk: 'Risk',
  other: 'Other',
};

// Pill colors. Picked so each sub-vertical is distinguishable at a glance
// without sacrificing dark-mode legibility.
const CATEGORY_STYLES: Record<string, string> = {
  investment_banking: 'bg-blue-100 text-blue-900 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900/60',
  sales_trading: 'bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-900/60',
  research: 'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900/60',
  asset_management: 'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/60',
  wealth_management: 'bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900/60',
  private_equity: 'bg-purple-100 text-purple-900 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:ring-purple-900/60',
  private_credit: 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:ring-fuchsia-900/60',
  hedge_fund: 'bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900/60',
  quant: 'bg-indigo-100 text-indigo-900 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900/60',
  risk_compliance: 'bg-yellow-100 text-yellow-900 ring-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-200 dark:ring-yellow-900/60',
  technology: 'bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/60',
  corporate_functions: 'bg-slate-100 text-slate-900 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  risk: 'bg-yellow-100 text-yellow-900 ring-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-200 dark:ring-yellow-900/60',
  other: 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
};

// Filter chip order — front office first, then mid/back, then cross-functional.
const FILTER_ORDER: string[] = [
  'investment_banking',
  'sales_trading',
  'research',
  'asset_management',
  'wealth_management',
  'private_equity',
  'private_credit',
  'hedge_fund',
  'quant',
  'risk_compliance',
  'technology',
  'corporate_functions',
  'other',
];

const PROGRAMME_LABELS: Record<string, string> = {
  spring_week: 'Spring Week',
  summer_internship: 'Summer Internship',
  off_cycle_internship: 'Off-cycle Internship',
  industrial_placement: 'Industrial Placement',
  graduate: 'Graduate',
  entry_level: 'Entry Level',
  mid_level: 'Mid Level',
  senior: 'Senior',
  // Legacy. classify() no longer emits this; existing rows were reclassified
  // by migration 0013 into the new tiers. Kept here so any lingering value
  // renders something sensible instead of an empty pill.
  experienced: 'Experienced',
  unknown: '',
};

// Order matches the rough early-career-to-senior ladder a student scans.
// Excludes `experienced` (deprecated) and `unknown` (no useful filter target).
const PROGRAMME_FILTER_ORDER: string[] = [
  'spring_week',
  'summer_internship',
  'off_cycle_internship',
  'industrial_placement',
  'graduate',
  'entry_level',
  'mid_level',
  'senior',
];

// PostgREST returns an embedded one-to-many parent ("firm" off "jobs") as a
// single object when the FK relationship is unambiguous and as an array when
// it can't tell. The runtime is always one object for us because
// jobs.firm_id -> firms.id is a single FK; we accept the array shape as a
// defensive fallback so a future schema rename doesn't silently empty the
// firm name in the UI.
type FirmRel =
  | { name: string; slug: string; logo_url: string | null }
  | Array<{ name: string; slug: string; logo_url: string | null }>
  | null;

interface JobRow {
  id: string;
  title: string;
  location: string | null;
  apply_url: string;
  category: string;
  programme: string;
  detected_at: string;
  firm: FirmRel;
}

function firmOf(rel: FirmRel): { name: string; slug: string; logo_url: string | null } | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function parsePage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  // Clamp absurd inputs so an attacker can't make us .range() into the
  // millions and force a planner walk on every request.
  return Math.min(Math.floor(n), 10_000);
}

// Defense in depth against stored XSS from ATS-supplied URLs. The DB has a
// matching CHECK constraint (migration 0007) so this is belt-and-braces, but
// the render layer is the one closest to the DOM and must not trust the row.
// Returns the safe href, or null when the row should not render a CTA.
function safeApplyHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseCategory(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return FILTER_ORDER.includes(v) ? v : null;
}

function parseProgramme(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return PROGRAMME_FILTER_ORDER.includes(v) ? v : null;
}

// Build a querystring that preserves all active filters except `omit`, which
// is the one being toggled. Avoids the common bug where clicking a category
// chip wipes the programme filter (and vice versa).
function filterHref(params: {
  category?: string | null;
  programme?: string | null;
  omit?: 'category' | 'programme';
  value?: string | null;
}): string {
  const next: Record<string, string> = {};
  if (params.category && params.omit !== 'category') next.category = params.category;
  if (params.programme && params.omit !== 'programme') next.programme = params.programme;
  if (params.omit && params.value) next[params.omit] = params.value;
  const qs = new URLSearchParams(next).toString();
  return qs ? `/jobs?${qs}` : '/jobs';
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const category = parseCategory(params.category);
  const programme = parseProgramme(params.programme);
  const supabase = await getSupabaseServerClient();

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  let query = supabase
    .from('jobs')
    .select(
      'id,title,location,apply_url,category,programme,detected_at,firm:firms(name,slug,logo_url)',
      // 'planned' uses the Postgres planner estimate instead of a full
      // COUNT(*) over the filtered set. The total here drives pagination and
      // a header label, neither of which needs row-exact accuracy. As the
      // jobs table grows, 'exact' becomes the slowest part of the page render.
      { count: 'planned' },
    )
    .is('closed_at', null);
  if (category) query = query.eq('category', category);
  if (programme) query = query.eq('programme', programme);
  query = query.order('detected_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <BackButton fallbackHref="/" label="Home" />
          <Link
            href="/"
            className="text-xs font-medium tracking-wider text-muted-foreground uppercase hover:text-foreground"
          >
            PMC Jobs
          </Link>
          <SyncButton />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Open roles in London finance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString()} UK roles detected
          {category ? ` in ${CATEGORY_LABELS[category]}` : ''}
          {programme ? ` · ${PROGRAMME_LABELS[programme]}` : ''}.
          {' '}Showing {Math.min(from + 1, total)}–{Math.min(to + 1, total)}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Curated for Portfolio Management Club members — open to everyone. Bulge bracket banks, elite boutiques, large AMs, PE and HF, polled directly from each firm&apos;s ATS. New postings surface within minutes; Sync just pulls what is already in our database.
        </p>
      </header>

      <CategoryFilter active={category} programme={programme} />
      <ProgrammeFilter active={programme} category={category} />

      {error ? (
        <ErrorBlock message={error.message} />
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {(data as unknown as JobRow[]).map((job) => {
              const firm = firmOf(job.firm);
              const href = safeApplyHref(job.apply_url);
              return (
                <li key={job.id} className="flex items-start justify-between gap-4 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {firm?.name ?? 'Unknown firm'}
                      </span>
                      <span aria-hidden>•</span>
                      <span>{job.location ?? 'Location not stated'}</span>
                      <span aria-hidden>•</span>
                      <span>{timeAgo(job.detected_at)}</span>
                    </div>
                    <h2 className="mt-1 truncate text-base font-medium text-foreground">{job.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <CategoryPill category={job.category} />
                      {PROGRAMME_LABELS[job.programme] ? (
                        <ProgrammePill>{PROGRAMME_LABELS[job.programme]}</ProgrammePill>
                      ) : null}
                    </div>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Open application
                    </a>
                  ) : (
                    <span
                      title="Apply URL invalid; visit the firm's careers page directly."
                      className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-md border border-dashed border-border px-3 text-sm font-medium text-muted-foreground"
                    >
                      Link unavailable
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            category={category}
            programme={programme}
          />
        </>
      )}
    </main>
  );
}

function CategoryFilter({
  active,
  programme,
}: {
  active: string | null;
  programme: string | null;
}) {
  return (
    <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Filter by category">
      <FilterLabel>Sub-vertical</FilterLabel>
      <FilterLink
        href={filterHref({ programme, omit: 'category', value: null })}
        isActive={active === null}
      >
        All
      </FilterLink>
      {FILTER_ORDER.map((cat) => (
        <FilterLink
          key={cat}
          href={filterHref({ programme, omit: 'category', value: cat })}
          isActive={active === cat}
        >
          {CATEGORY_LABELS[cat]}
        </FilterLink>
      ))}
    </nav>
  );
}

function ProgrammeFilter({
  active,
  category,
}: {
  active: string | null;
  category: string | null;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Filter by tenure or programme">
      <FilterLabel>Tenure</FilterLabel>
      <FilterLink
        href={filterHref({ category, omit: 'programme', value: null })}
        isActive={active === null}
      >
        All
      </FilterLink>
      {PROGRAMME_FILTER_ORDER.map((prog) => (
        <FilterLink
          key={prog}
          href={filterHref({ category, omit: 'programme', value: prog })}
          isActive={active === prog}
        >
          {PROGRAMME_LABELS[prog]}
        </FilterLink>
      ))}
    </nav>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-flex items-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function FilterLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (isActive
          ? 'bg-foreground text-background'
          : 'border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground')
      }
    >
      {children}
    </Link>
  );
}

function CategoryPill({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const styles = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

function ProgrammePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  category,
  programme,
}: {
  page: number;
  totalPages: number;
  category: string | null;
  programme: string | null;
}) {
  if (totalPages <= 1) return null;
  const baseParams: Record<string, string> = {};
  if (category) baseParams.category = category;
  if (programme) baseParams.programme = programme;
  const hrefFor = (p: number) => {
    const qs = new URLSearchParams({ ...baseParams, page: String(p) }).toString();
    return `/jobs?${qs}`;
  };
  const prev = page > 1 ? hrefFor(page - 1) : null;
  const next = page < totalPages ? hrefFor(page + 1) : null;

  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
      <PageLink href={prev}>← Previous</PageLink>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <PageLink href={next}>Next →</PageLink>
    </nav>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const styles = 'inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium';
  if (!href) {
    return <span className={`${styles} cursor-not-allowed opacity-40`}>{children}</span>;
  }
  return (
    <Link href={href} className={`${styles} hover:bg-accent hover:text-accent-foreground`}>
      {children}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <h2 className="text-base font-medium text-foreground">No open roles match this filter</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try clearing the filter or run a poller to ingest fresh roles.
      </p>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      <p className="font-medium">Could not load jobs.</p>
      <p className="mt-1 opacity-80">{message}</p>
    </div>
  );
}
