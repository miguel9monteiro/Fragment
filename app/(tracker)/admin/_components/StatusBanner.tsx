// Fleet-health banner. Top of the cockpit: one giant pill that summarises
// "is the system healthy right now?" in three states:
//
//   green   no open critical alerts, fleet ingested in last 30 min
//   yellow  warn/error alerts open, OR ingestion has stalled
//   red     critical alert open (e.g. vault_missing, fleet_silent)
//
// Plus three small counters underneath: open alerts by severity, active firms
// in backoff, jobs ingested today. This is the headline answer to "is it
// working?" before the operator scrolls to detail sections.

import { Pill } from './ui';

import { getSupabaseAdminClient } from '@/tracker/lib/supabase/admin';

interface StatusSnapshot {
  open_critical: number;
  open_error: number;
  open_warn: number;
  open_info: number;
  active_firms: number;
  firms_in_backoff: number;
  jobs_ingested_today: number;
  upserted_30min: number;
}

async function loadStatus(): Promise<StatusSnapshot> {
  const admin = getSupabaseAdminClient();
  const since30 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Five parallel queries — each is small (count or aggregate). The whole
  // status panel hydrates in ~50ms.
  const [
    openAlertsRes,
    activeFirmsRes,
    inBackoffRes,
    jobsTodayRes,
    pollerUpsertsRes,
  ] = await Promise.all([
    admin
      .from('system_alerts')
      .select('level')
      .is('resolved_at', null),
    admin
      .from('firms')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    admin
      .from('firms')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .gt('consecutive_errors', 0),
    admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
    admin
      .from('poller_runs')
      .select('upserted')
      .gte('ran_at', since30),
  ]);

  const levels = (openAlertsRes.data ?? []) as { level: string }[];
  let critical = 0, error = 0, warn = 0, info = 0;
  for (const { level } of levels) {
    if (level === 'critical') critical += 1;
    else if (level === 'error') error += 1;
    else if (level === 'warn') warn += 1;
    else if (level === 'info') info += 1;
  }

  const upserted30 = (pollerUpsertsRes.data ?? [])
    .reduce((acc, r) => acc + (r.upserted ?? 0), 0);

  return {
    open_critical: critical,
    open_error: error,
    open_warn: warn,
    open_info: info,
    active_firms: activeFirmsRes.count ?? 0,
    firms_in_backoff: inBackoffRes.count ?? 0,
    jobs_ingested_today: jobsTodayRes.count ?? 0,
    upserted_30min: upserted30,
  };
}

export async function StatusBanner() {
  const s = await loadStatus();

  // Headline tone. "Critical alert open" overrides everything; otherwise
  // we promote to yellow if warn/error alerts exist OR if the fleet hasn't
  // upserted anything in the last 30 min (which usually means the WAF is
  // back and we should investigate, NOT that everything's fine).
  let tone: 'ok' | 'warn' | 'critical';
  let headline: string;
  if (s.open_critical > 0) {
    tone = 'critical';
    headline = `${s.open_critical} critical alert${s.open_critical === 1 ? '' : 's'} open`;
  } else if (s.open_error > 0 || s.open_warn > 0 || s.upserted_30min === 0) {
    tone = 'warn';
    headline = s.open_error + s.open_warn > 0
      ? `${s.open_error + s.open_warn} alert${(s.open_error + s.open_warn) === 1 ? '' : 's'} open`
      : 'Fleet quiet in last 30 minutes';
  } else {
    tone = 'ok';
    headline = 'All systems nominal';
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Pill tone={tone}>{tone === 'ok' ? '●' : tone === 'warn' ? '●' : '●'}</Pill>
            <h1 className="text-xl font-semibold tracking-tight">{headline}</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Open: {s.open_critical} critical · {s.open_error} error · {s.open_warn} warn ·{' '}
            {s.open_info} info
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <Metric label="Active firms" value={s.active_firms} />
          <Metric label="In backoff" value={s.firms_in_backoff} muted={s.firms_in_backoff === 0} />
          <Metric label="Jobs / 24h" value={s.jobs_ingested_today} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div>
      <p className={muted ? 'text-2xl font-semibold text-muted-foreground' : 'text-2xl font-semibold text-foreground'}>
        {value.toLocaleString('en-GB')}
      </p>
      <p className="text-xs tracking-wider text-muted-foreground uppercase">{label}</p>
    </div>
  );
}
