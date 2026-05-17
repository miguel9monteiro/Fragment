// Per-firm operations table. The cockpit's busiest section: every active
// and inactive firm with its current state, open-job count, backoff posture,
// and three quick actions:
//
//   Toggle      activate/deactivate. The most-used escape hatch when the
//               watchdog flags a firm whose ATS migrated.
//   Reset BO    zero the consecutive_errors / next_run_after so the firm
//               re-enters the rotation immediately. Use after fixing a
//               config.
//   Run         force-runs the firm's poll-<ats> function. Hits every
//               active firm of that ats (not just the clicked one), which
//               matches how the cron fires.
//
// Filter chips at the top let us narrow to active/inactive/erroring/in-
// backoff for triage. State lives in the URL (?filter=erroring) so the
// page can deep-link back to the same view after a refresh.

import Link from 'next/link';

import { resetFirmBackoff, toggleFirmActive } from '../_actions';
import { Pill, Section, timeAgo } from './ui';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

type FirmFilter = 'all' | 'active' | 'inactive' | 'erroring' | 'backoff' | 'no-success-24h';

interface FirmRow {
  id: string;
  slug: string;
  name: string;
  ats: string;
  active: boolean;
  careers_url: string | null;
  consecutive_errors: number;
  next_run_after: string | null;
  last_error_at: string | null;
  last_success_at: string | null;
}

const FILTER_OPTIONS: { key: FirmFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'erroring', label: 'Erroring' },
  { key: 'backoff', label: 'In backoff' },
  { key: 'no-success-24h', label: 'No success 24h' },
];

export async function FirmsTable({ filter }: { filter: FirmFilter }) {
  const admin = getSupabaseAdminClient();
  const { data: firmsData } = await admin
    .from('firms')
    .select('id,slug,name,ats,active,careers_url,consecutive_errors,next_run_after,last_error_at,last_success_at')
    .order('slug');
  const firms = (firmsData ?? []) as FirmRow[];

  // Live open-job counts in one query, joined client-side. Cheap because
  // jobs.firm_id is indexed and the table is small.
  const { data: counts } = await admin.rpc('firm_open_counts_for_admin');
  // Fall back to a client-side aggregate if the RPC isn't present yet.
  const countsMap = new Map<string, number>();
  if (counts && Array.isArray(counts)) {
    for (const c of counts as { firm_id: string; open_count: number }[]) {
      countsMap.set(c.firm_id, c.open_count);
    }
  } else {
    const { data: openJobs } = await admin
      .from('jobs')
      .select('firm_id')
      .is('closed_at', null);
    for (const j of (openJobs ?? []) as { firm_id: string }[]) {
      countsMap.set(j.firm_id, (countsMap.get(j.firm_id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const filtered = firms.filter((f) => {
    switch (filter) {
      case 'active': return f.active;
      case 'inactive': return !f.active;
      case 'erroring': return f.active && f.consecutive_errors > 0;
      case 'backoff': return f.active && !!f.next_run_after && new Date(f.next_run_after).getTime() > now;
      case 'no-success-24h':
        return f.active && (!f.last_success_at || (now - new Date(f.last_success_at).getTime()) > 24 * 60 * 60 * 1000);
      case 'all':
      default: return true;
    }
  });

  return (
    <Section
      title="Firms"
      subtitle={`${filtered.length} of ${firms.length}`}
      action={
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter firms">
          {FILTER_OPTIONS.map((opt) => {
            const href = opt.key === 'all' ? '/admin' : `/admin?firms=${opt.key}`;
            return (
              <Link
                key={opt.key}
                href={href}
                className={
                  'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors ' +
                  (filter === opt.key
                    ? 'bg-foreground text-background'
                    : 'border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground')
                }
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">Firm</th>
              <th className="px-3 py-2 font-medium">ATS</th>
              <th className="px-3 py-2 text-right font-medium">Open</th>
              <th className="px-3 py-2 text-right font-medium">Errs</th>
              <th className="px-3 py-2 font-medium">Next try</th>
              <th className="px-3 py-2 font-medium">Last ok</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((f) => (
              <FirmRow key={f.id} firm={f} openCount={countsMap.get(f.id) ?? 0} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function FirmRow({ firm: f, openCount }: { firm: FirmRow; openCount: number }) {
  const now = Date.now();
  const inBackoff = !!f.next_run_after && new Date(f.next_run_after).getTime() > now;
  const stateTone = !f.active
    ? 'muted'
    : f.consecutive_errors >= 3
      ? 'error'
      : f.consecutive_errors > 0
        ? 'warn'
        : 'ok';

  return (
    <tr>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Pill tone={stateTone}>●</Pill>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{f.name}</span>
              {!f.active ? <Pill tone="muted">inactive</Pill> : null}
              {inBackoff ? <Pill tone="warn">backoff</Pill> : null}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{f.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs">{f.ats}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link href={`/jobs?firm=${f.slug}`} className="font-mono text-xs hover:underline">
          {openCount}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">{f.consecutive_errors}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {inBackoff && f.next_run_after
          ? `in ${Math.max(0, Math.round((new Date(f.next_run_after).getTime() - now) / 60_000))}m`
          : f.active
            ? 'next tick'
            : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(f.last_success_at)}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <form action={toggleFirmActive}>
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="next" value={f.active ? 'false' : 'true'} />
            <button
              type="submit"
              className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title={f.active ? 'Deactivate firm' : 'Activate firm'}
            >
              {f.active ? 'Off' : 'On'}
            </button>
          </form>
          {f.active && (f.consecutive_errors > 0 || inBackoff) ? (
            <form action={resetFirmBackoff}>
              <input type="hidden" name="id" value={f.id} />
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title="Reset consecutive_errors=0, next_run_after=null"
              >
                Reset
              </button>
            </form>
          ) : null}
          {f.careers_url ? (
            <a
              href={f.careers_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Open the firm's careers page"
            >
              Site
            </a>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
