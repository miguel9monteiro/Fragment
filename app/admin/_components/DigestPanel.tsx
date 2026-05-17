// Today's daily digest snapshot. Displays the most recent daily_digests row
// — number of new jobs, top sub-verticals, top tenures, channels the digest
// was pushed to. The rendered_text body is rendered in a monospace block so
// the operator can read it the same way it lands in their email/Discord.
//
// "Force run" button regenerates the digest on demand (idempotent: same
// London-local date only writes once, but force-running mid-day will not
// overwrite an existing row).

import { forceRunPoller } from '../_actions';
import { EmptyState, Pill, Section, timeAgo } from './ui';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

interface DigestRow {
  digest_date: string;
  generated_at: string;
  sent_via: string[];
  summary: unknown;
  rendered_text: string | null;
}

interface DigestSummary {
  ingest?: { new_jobs?: number; by_category?: Record<string, number>; by_programme?: Record<string, number> };
  alerts?: { open?: number; new_24h?: number; resolved_24h?: number };
  fleet?: { poller_runs?: number; poller_runs_errored?: number };
}

export async function DigestPanel() {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('daily_digests')
    .select('digest_date,generated_at,sent_via,summary,rendered_text')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const digest = data as DigestRow | null;

  return (
    <Section
      title="Daily digest"
      subtitle={digest ? `${digest.digest_date} · generated ${timeAgo(digest.generated_at)}` : 'no digest yet'}
      action={
        <form action={forceRunPoller}>
          <input type="hidden" name="fn" value="poll-daily-digest" />
          <button
            type="submit"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Run now
          </button>
        </form>
      }
    >
      {!digest ? (
        <EmptyState>
          No digest generated yet. Click <span className="font-mono">Run now</span> to seed the first one,
          or wait for the 06:00 UTC cron.
        </EmptyState>
      ) : (
        <DigestBody digest={digest} />
      )}
    </Section>
  );
}

function DigestBody({ digest }: { digest: DigestRow }) {
  const summary = (digest.summary ?? {}) as DigestSummary;
  const newJobs = summary.ingest?.new_jobs ?? 0;
  const openAlerts = summary.alerts?.open ?? 0;
  const errPct = summary.fleet
    ? Math.round(((summary.fleet.poller_runs_errored ?? 0) / Math.max(1, summary.fleet.poller_runs ?? 0)) * 100)
    : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <Stat label="New jobs (24h)" value={newJobs.toString()} />
        <Stat label="Poller error rate" value={`${errPct}%`} />
        <Stat label="Open alerts" value={openAlerts.toString()} />
        <Stat
          label="Sent via"
          value={digest.sent_via.length === 0 ? 'DB only' : digest.sent_via.join(', ')}
        />
      </div>
      <details className="rounded-md border border-border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground select-none">
          Show rendered text
        </summary>
        <pre className="max-h-96 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
{digest.rendered_text ?? '(no rendered text)'}
        </pre>
      </details>
      <div className="flex flex-wrap gap-2 text-xs">
        {digest.sent_via.includes('email') ? <Pill tone="ok">email sent</Pill> : <Pill tone="muted">email skipped</Pill>}
        {digest.sent_via.includes('discord') ? <Pill tone="ok">discord sent</Pill> : <Pill tone="muted">discord skipped</Pill>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-base font-semibold">{value}</p>
      <p className="text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
