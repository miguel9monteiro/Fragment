// Per-source 24-hour health. One row per Edge Function (poll-workday,
// poll-greenhouse, etc), with totals + error rate + a "Run now" button. The
// run-now hits the _invoke_poller SQL helper which goes through Vault, so
// it's the same code path as the cron — no special manual-run plumbing.

import { forceRunPoller } from '../_actions';
import { EmptyState, Pill, Section, formatPercent } from './ui';

import { getSupabaseAdminClient } from '@/tracker/lib/supabase/admin';

interface PerSource {
  source: string;
  runs: number;
  errs: number;
  upserts: number;
  uk: number;
  last_ran_at: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  'poll-workday': 'Workday',
  'poll-greenhouse': 'Greenhouse',
  'poll-lever': 'Lever',
  'poll-workable': 'Workable',
  'poll-teamtailor': 'TeamTailor',
  'poll-smartrecruiters': 'SmartRecruiters',
  'poll-oracle-hcm': 'Oracle HCM',
  'poll-eightfold': 'Eightfold',
  'poll-oleeo': 'Oleeo',
  'poll-avature': 'Avature',
  'poll-watchdog': 'Watchdog',
  'poll-daily-digest': 'Daily digest',
  'poll-host-probe': 'Host probe',
  'poll-careers-scan': 'Careers scan',
};

async function loadFleet(): Promise<PerSource[]> {
  const admin = getSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Pull the raw rows and roll up in JS rather than ship 10+ aggregate
  // RPCs. 24h × 1k rows/min cap = ~80k rows; we limit to 200k as a safety
  // floor and accept the bandwidth.
  const { data } = await admin
    .from('poller_runs')
    .select('source,error,upserted,uk,ran_at')
    .gte('ran_at', since)
    .limit(200_000);

  const map = new Map<string, PerSource>();
  for (const r of (data ?? []) as { source: string; error: string | null; upserted: number; uk: number; ran_at: string }[]) {
    const e = map.get(r.source) ?? {
      source: r.source,
      runs: 0, errs: 0, upserts: 0, uk: 0,
      last_ran_at: null as string | null,
    };
    e.runs += 1;
    if (r.error) e.errs += 1;
    e.upserts += r.upserted ?? 0;
    e.uk += r.uk ?? 0;
    if (!e.last_ran_at || r.ran_at > e.last_ran_at) e.last_ran_at = r.ran_at;
    map.set(r.source, e);
  }
  return Array.from(map.values()).sort((a, b) => a.source.localeCompare(b.source));
}

export async function FleetHealthTable() {
  const rows = await loadFleet();

  return (
    <Section title="Fleet health" subtitle="last 24 hours per source">
      {rows.length === 0 ? (
        <EmptyState>
          No poller runs in the last 24h. If you just provisioned the project, give
          cron a minute. If not, the vault_missing alert is likely open above.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs tracking-wider text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Runs</th>
                <th className="px-3 py-2 text-right font-medium">Errs</th>
                <th className="px-3 py-2 text-right font-medium">Err rate</th>
                <th className="px-3 py-2 text-right font-medium">Upserts</th>
                <th className="px-3 py-2 text-right font-medium">UK fetched</th>
                <th className="px-3 py-2 font-medium">Last ran</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const errRate = r.runs > 0 ? r.errs / r.runs : 0;
                const tone = r.errs === 0 ? 'ok' : errRate >= 0.5 ? 'critical' : errRate >= 0.1 ? 'warn' : 'info';
                return (
                  <tr key={r.source}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Pill tone={tone}>●</Pill>
                        <span className="font-medium">{SOURCE_LABELS[r.source] ?? r.source}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{r.runs}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{r.errs}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {formatPercent(r.errs, r.runs)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{r.upserts}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{r.uk}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.last_ran_at
                        ? new Date(r.last_ran_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <form action={forceRunPoller}>
                        <input type="hidden" name="fn" value={r.source} />
                        <button
                          type="submit"
                          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Run
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
