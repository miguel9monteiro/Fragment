// Last 20 UK jobs ingested. Sorted by detected_at DESC, with sub-vertical
// + tenure pills so the operator can sanity-check the classifier output
// alongside the ingest activity. Each row links to the actual apply URL
// in a new tab — useful when an ATS upgrade silently changes the URL
// pattern and we want to spot-check that the link still resolves.

import { EmptyState, Pill, Section, timeAgo } from './ui';

import { getSupabaseAdminClient } from '@/tracker/lib/supabase/admin';

interface JobRow {
  id: string;
  title: string;
  location: string | null;
  apply_url: string;
  category: string;
  programme: string;
  detected_at: string;
  firm: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  investment_banking: 'IB',
  sales_trading: 'S&T',
  research: 'Research',
  asset_management: 'AM',
  wealth_management: 'WM',
  private_equity: 'PE',
  private_credit: 'PC',
  hedge_fund: 'HF',
  quant: 'Quant',
  risk_compliance: 'R&C',
  technology: 'Tech',
  corporate_functions: 'Corp',
  other: 'Other',
};

const PROGRAMME_LABELS: Record<string, string> = {
  spring_week: 'Spring',
  summer_internship: 'Summer',
  off_cycle_internship: 'Off-cycle',
  industrial_placement: 'Placement',
  graduate: 'Graduate',
  entry_level: 'Entry',
  mid_level: 'Mid',
  senior: 'Senior',
  experienced: 'Experienced',
  unknown: '',
};

function firmOf(rel: JobRow['firm']): { slug: string; name: string } | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function RecentJobsList() {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('jobs')
    .select('id,title,location,apply_url,category,programme,detected_at,firm:firms(slug,name)')
    .is('closed_at', null)
    .order('detected_at', { ascending: false })
    .limit(20);

  const jobs = (data ?? []) as unknown as JobRow[];

  return (
    <Section title="Recent jobs" subtitle="20 most recently detected UK roles">
      {jobs.length === 0 ? (
        <EmptyState>No jobs ingested yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((j) => {
            const firm = firmOf(j.firm);
            const href = safeHref(j.apply_url);
            return (
              <li key={j.id} className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{firm?.name ?? 'Unknown'}</span>
                    {j.location ? <span>· {j.location}</span> : null}
                    <span>· {timeAgo(j.detected_at)}</span>
                  </div>
                  <p className="text-sm break-words">{j.title}</p>
                  <div className="flex flex-wrap gap-1">
                    <Pill tone="info">{CATEGORY_LABELS[j.category] ?? j.category}</Pill>
                    {PROGRAMME_LABELS[j.programme] ? (
                      <Pill tone="muted">{PROGRAMME_LABELS[j.programme]}</Pill>
                    ) : null}
                  </div>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Open
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
