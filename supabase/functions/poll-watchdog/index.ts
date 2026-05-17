// Tier-0 observability watchdog. Reads poller_runs telemetry, computes a
// small set of detection rules, and raises / resolves rows in system_alerts
// accordingly. Optionally sends Resend email notifications on alert state
// transitions if RESEND_API_KEY + ALERT_EMAIL_TO env vars are configured.
//
// Cron: every 15 minutes (see migration 0019_schedule_watchdog_and_prune.sql).
//
// Alert sinks (independent — set whichever env vars are configured):
//   RESEND_API_KEY + ALERT_EMAIL_TO   -> send email via Resend
//   DISCORD_WEBHOOK_URL                -> POST a Discord embed to a channel
// If none are configured, alerts still land in system_alerts and the function
// returns 200. Sinks fire in parallel and any one failing logs a warning
// without aborting the watchdog run.
//
// Detection rules:
//
//   firm_errors   Per (firm, source). If the LAST 3 poller_runs are all
//                 errored, raise. Resolves on the next successful run.
//                 Catches WAF blocks, bad hostnames, schema drift.
//
//   firm_zero_uk  Per (firm, source). Over the last 7 days, if we ran the
//                 firm >= 100 times, saw fetched > 0, but uk = 0, raise.
//                 Catches "we're scraping but the UK filter rejects all"
//                 cases (e.g. an Avature tenant whose location markup
//                 changed and broke our regex).
//
//   fleet_silent  Across all sources, last 30 min. If runs > 0 but
//                 upserted across the fleet = 0, raise. Catches systemic
//                 outages (DB unreachable, runner exception, etc).
//
//   firm_volume_drop  Per firm. Current open_count vs rolling 30-day p50
//                 baseline (computed server-side from firm_volume_snapshots).
//                 Raise when current < 0.3 × p50 AND baseline >= 5 (avoids
//                 noise on tiny boutiques). Resolves when current >=
//                 0.5 × p50. Catches silent coverage decay: a firm runs
//                 fine, no errors, but the open-role count is way below
//                 normal (parser drift, WAF block we didn't notice yet).
//
// Idempotency: each (kind, firm_id) has at most one open alert at a time
// (enforced by partial unique index on system_alerts). Raise = INSERT ...
// ON CONFLICT DO NOTHING. Resolve = UPDATE ... WHERE resolved_at IS NULL.
//
// Email policy: send exactly one email per state transition (raise OR
// resolve). Reads recipient + Resend API key from edge function env. If
// either is missing, alerts still land in system_alerts and the function
// returns 200 — the operator can read them via SQL or the future /admin UI.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

type AlertLevel = 'info' | 'warn' | 'error' | 'critical';
type AlertKind = 'firm_errors' | 'firm_zero_uk' | 'fleet_silent' | 'firm_volume_drop';

interface AlertCandidate {
  kind: AlertKind;
  level: AlertLevel;
  firm_id: string | null;
  firm_slug: string | null;
  message: string;
  detail: Record<string, unknown>;
}

interface OpenAlertRow {
  id: number;
  kind: AlertKind | 'vault_missing';
  firm_id: string | null;
  message: string;
  raised_at: string;
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'poll-watchdog', ...payload }));
}

// ---------------------------------------------------------------------------
// Detection rules
// ---------------------------------------------------------------------------

interface FirmRunsRow {
  firm_id: string | null;
  firm_slug: string | null;
  source: string;
  error: string | null;
  fetched: number;
  uk: number;
  upserted: number;
  ran_at: string;
}

async function detectFirmErrors(supabase: SupabaseClient): Promise<AlertCandidate[]> {
  // Pull the last 5 rows per (firm, source) over the last 60 min. The
  // window is wide enough to span 5 cron ticks for the slowest poller
  // (avature runs every 2 min). The detection only inspects the most
  // recent 3 rows; pulling 5 lets us see firms that *just* recovered.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('poller_runs')
    .select('firm_id,firm_slug,source,error,fetched,uk,upserted,ran_at')
    .gte('ran_at', since)
    .not('firm_id', 'is', null)
    .order('ran_at', { ascending: false });
  if (error) throw new Error(`firm_errors query: ${error.message}`);

  const grouped = new Map<string, FirmRunsRow[]>();
  for (const row of (data ?? []) as FirmRunsRow[]) {
    const key = `${row.firm_id}::${row.source}`;
    const arr = grouped.get(key) ?? [];
    if (arr.length < 5) arr.push(row);
    grouped.set(key, arr);
  }

  const out: AlertCandidate[] = [];
  for (const rows of grouped.values()) {
    if (rows.length < 3) continue; // not enough signal yet
    const lastThree = rows.slice(0, 3);
    if (lastThree.every((r) => r.error !== null)) {
      // Truncate the latest error so the detail jsonb stays small. The full
      // history is still queryable from poller_runs by firm + ran_at.
      const errExcerpt = (lastThree[0].error ?? '').slice(0, 500);
      out.push({
        kind: 'firm_errors',
        level: 'error',
        firm_id: lastThree[0].firm_id,
        firm_slug: lastThree[0].firm_slug,
        message: `3 consecutive errors on ${lastThree[0].firm_slug} (${lastThree[0].source})`,
        detail: {
          source: lastThree[0].source,
          consecutiveErrors: 3,
          latestError: errExcerpt,
          windowSize: rows.length,
        },
      });
    }
  }
  return out;
}

async function detectFirmZeroUk(supabase: SupabaseClient): Promise<AlertCandidate[]> {
  // 7-day per-firm aggregate. Postgres aggregates are cheap on the
  // (firm_id, ran_at) index; we don't try to do this client-side because
  // 80k rows/day × 7 = ~560k rows is too many to ship over the wire.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc('watchdog_firm_zero_uk_candidates', {
    p_since: since,
    p_min_runs: 100,
  });
  if (error) {
    // The RPC doesn't exist yet on first deploy — fall back to a client-side
    // aggregate over a smaller window so the watchdog isn't blocked on the
    // RPC ship. The conservative window is 2 days × 1000 row cap.
    log({ level: 'info', event: 'firm_zero_uk_rpc_missing', fallback: 'client_aggregate', message: error.message });
    return await detectFirmZeroUkFallback(supabase);
  }
  type Row = { firm_id: string; firm_slug: string; source: string; runs: number; fetched: number; uk: number };
  const rows = (data ?? []) as Row[];
  return rows.map((r) => ({
    kind: 'firm_zero_uk' as const,
    level: 'warn' as const,
    firm_id: r.firm_id,
    firm_slug: r.firm_slug,
    message: `${r.firm_slug} (${r.source}): ${r.runs} runs in 7d, ${r.fetched} fetched, 0 UK roles`,
    detail: { source: r.source, runs: r.runs, fetched: r.fetched, uk: r.uk, windowDays: 7 },
  }));
}

async function detectFirmZeroUkFallback(supabase: SupabaseClient): Promise<AlertCandidate[]> {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('poller_runs')
    .select('firm_id,firm_slug,source,fetched,uk')
    .gte('ran_at', since)
    .not('firm_id', 'is', null)
    .limit(50_000);
  if (error) throw new Error(`firm_zero_uk fallback query: ${error.message}`);
  type Row = { firm_id: string; firm_slug: string; source: string; fetched: number; uk: number };
  const grouped = new Map<string, { firm_id: string; firm_slug: string; source: string; runs: number; fetched: number; uk: number }>();
  for (const row of (data ?? []) as Row[]) {
    const key = `${row.firm_id}::${row.source}`;
    const g = grouped.get(key) ?? { firm_id: row.firm_id, firm_slug: row.firm_slug, source: row.source, runs: 0, fetched: 0, uk: 0 };
    g.runs += 1;
    g.fetched += row.fetched;
    g.uk += row.uk;
    grouped.set(key, g);
  }
  const out: AlertCandidate[] = [];
  for (const g of grouped.values()) {
    if (g.runs >= 200 && g.fetched > 0 && g.uk === 0) {
      out.push({
        kind: 'firm_zero_uk',
        level: 'warn',
        firm_id: g.firm_id,
        firm_slug: g.firm_slug,
        message: `${g.firm_slug} (${g.source}): ${g.runs} runs in 2d, ${g.fetched} fetched, 0 UK roles`,
        detail: { source: g.source, runs: g.runs, fetched: g.fetched, uk: g.uk, windowDays: 2, fallback: true },
      });
    }
  }
  return out;
}

async function detectFirmVolumeDrop(supabase: SupabaseClient): Promise<AlertCandidate[]> {
  // Server-side aggregate via RPC — joins live jobs counts with the rolling
  // baseline from firm_volume_snapshots and returns only the firms that
  // currently meet the drop criteria.
  //
  // Window: 30 days. Threshold: 0.3 × p50. Minimum samples: 7 (one week of
  // daily snapshots). Minimum baseline: 5 open roles (anything smaller is
  // too noisy to alert on). All parameters are knobs on the RPC.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc('watchdog_volume_drop_candidates', {
    p_since: since,
    p_min_samples: 7,
    p_drop_factor: 0.3,
    p_min_baseline: 5,
  });
  if (error) {
    // The RPC is shipped alongside this rule, but if a rollback removes it
    // the rule degrades gracefully — log and return no candidates. The
    // watchdog stays functional for the other three rules.
    log({ level: 'info', event: 'firm_volume_drop_rpc_missing', message: error.message });
    return [];
  }
  type Row = { firm_id: string; firm_slug: string; current_count: number; baseline_p50: number; samples: number };
  const rows = (data ?? []) as Row[];
  return rows.map((r) => ({
    kind: 'firm_volume_drop' as const,
    level: 'warn' as const,
    firm_id: r.firm_id,
    firm_slug: r.firm_slug,
    message: `${r.firm_slug}: ${r.current_count} open roles vs p50 baseline ${Math.round(r.baseline_p50)} (${r.samples} samples)`,
    detail: {
      current_count: r.current_count,
      baseline_p50: r.baseline_p50,
      samples: r.samples,
      threshold_factor: 0.3,
    },
  }));
}

async function detectFleetSilent(supabase: SupabaseClient): Promise<AlertCandidate[]> {
  // 30-min fleet aggregate. If runs > 0 but upserted = 0 fleet-wide, every
  // poller is fetching but nothing is reaching the DB — points at an upsert /
  // RLS / classifier exception. If runs = 0, cron has stopped firing entirely.
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('poller_runs')
    .select('fetched,upserted')
    .gte('ran_at', since)
    .limit(50_000);
  if (error) throw new Error(`fleet_silent query: ${error.message}`);

  let runs = 0;
  let fetched = 0;
  let upserted = 0;
  for (const row of (data ?? []) as { fetched: number; upserted: number }[]) {
    runs += 1;
    fetched += row.fetched;
    upserted += row.upserted;
  }

  if (runs === 0) {
    // Cron stopped entirely. Watchdog itself is running (we're inside it),
    // so the other crons are the suspect — Vault secrets, pg_net, or
    // _invoke_poller. The vault_missing alert (raised by _invoke_poller)
    // would normally fire first; if THIS triggers without vault_missing
    // present, the failure is elsewhere.
    return [{
      kind: 'fleet_silent',
      level: 'critical',
      firm_id: null,
      firm_slug: null,
      message: 'No poller runs in the last 30 minutes — fleet is silent.',
      detail: { runs: 0, fetched: 0, upserted: 0, windowMinutes: 30 },
    }];
  }

  if (fetched > 0 && upserted === 0) {
    return [{
      kind: 'fleet_silent',
      level: 'critical',
      firm_id: null,
      firm_slug: null,
      message: `Fleet is fetching but nothing is landing in jobs (runs=${runs}, fetched=${fetched}, upserted=0)`,
      detail: { runs, fetched, upserted, windowMinutes: 30 },
    }];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Alert lifecycle (raise + resolve)
// ---------------------------------------------------------------------------

async function loadOpenAlerts(supabase: SupabaseClient, kinds: AlertKind[]): Promise<OpenAlertRow[]> {
  const { data, error } = await supabase
    .from('system_alerts')
    .select('id,kind,firm_id,message,raised_at')
    .in('kind', kinds)
    .is('resolved_at', null);
  if (error) throw new Error(`load open alerts: ${error.message}`);
  return (data ?? []) as OpenAlertRow[];
}

function candidateKey(c: { kind: string; firm_id: string | null }): string {
  return `${c.kind}::${c.firm_id ?? '_fleet_'}`;
}

interface Transitions {
  raised: AlertCandidate[];
  resolved: OpenAlertRow[];
}

async function reconcileAlerts(
  supabase: SupabaseClient,
  candidates: AlertCandidate[],
  openAlerts: OpenAlertRow[],
): Promise<Transitions> {
  const candidateByKey = new Map(candidates.map((c) => [candidateKey(c), c]));
  const openByKey = new Map(openAlerts.map((a) => [candidateKey(a), a]));

  const raised: AlertCandidate[] = [];
  for (const c of candidates) {
    if (openByKey.has(candidateKey(c))) continue;
    raised.push(c);
  }

  const resolved: OpenAlertRow[] = [];
  for (const a of openAlerts) {
    if (candidateByKey.has(candidateKey(a))) continue;
    resolved.push(a);
  }

  if (raised.length > 0) {
    const insertRows = raised.map((c) => ({
      level: c.level,
      kind: c.kind,
      firm_id: c.firm_id,
      message: c.message,
      detail: c.detail,
    }));
    // The partial unique index covers (kind, coalesce(firm_id::text, '_fleet_'))
    // where resolved_at is null, so a concurrent watchdog run cannot insert a
    // duplicate. We don't bother with ON CONFLICT — the supabase-js client
    // surfaces the unique-violation as an error, which we tolerate per-row.
    for (const row of insertRows) {
      const { error: insertErr } = await supabase.from('system_alerts').insert(row);
      if (insertErr && !/duplicate key|unique constraint/i.test(insertErr.message)) {
        log({ level: 'warn', event: 'alert_insert_failed', error: insertErr.message, alert: row });
      }
    }
  }

  if (resolved.length > 0) {
    const ids = resolved.map((a) => a.id);
    const { error: updateErr } = await supabase
      .from('system_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .in('id', ids);
    if (updateErr) {
      log({ level: 'warn', event: 'alert_resolve_failed', error: updateErr.message, ids });
    }
  }

  return { raised, resolved };
}

// ---------------------------------------------------------------------------
// Resend email notifier (optional)
// ---------------------------------------------------------------------------

async function notifyEmail(transitions: Transitions, vaultMissing: OpenAlertRow[]): Promise<void> {
  // Each is supplied via `supabase secrets set` (Edge Function env). When
  // either is missing we skip silently — alerts still live in system_alerts.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ALERT_EMAIL_TO');
  const from = Deno.env.get('ALERT_EMAIL_FROM') ?? 'onboarding@resend.dev';
  if (!apiKey || !to) {
    if (transitions.raised.length + transitions.resolved.length + vaultMissing.length > 0) {
      log({ level: 'info', event: 'email_skipped_no_config', raised: transitions.raised.length, resolved: transitions.resolved.length });
    }
    return;
  }

  // Bundle every transition into one email. The watchdog runs every 15 min,
  // so the worst case is one email per 15 min — well below Resend's rate.
  const interesting = transitions.raised.length + transitions.resolved.length + vaultMissing.length;
  if (interesting === 0) return;

  const lines: string[] = ['Fragment Tracker watchdog summary', ''];
  if (vaultMissing.length > 0) {
    lines.push('CRITICAL: Vault secret(s) missing — pollers are inert:');
    for (const a of vaultMissing) lines.push(`  - ${a.message}`);
    lines.push('');
  }
  if (transitions.raised.length > 0) {
    lines.push(`NEW alerts (${transitions.raised.length}):`);
    for (const a of transitions.raised) lines.push(`  - [${a.level}] ${a.kind}: ${a.message}`);
    lines.push('');
  }
  if (transitions.resolved.length > 0) {
    lines.push(`RESOLVED alerts (${transitions.resolved.length}):`);
    for (const a of transitions.resolved) lines.push(`  - ${a.kind}: ${a.message}`);
    lines.push('');
  }
  lines.push('Detail: select * from system_alerts where resolved_at is null order by raised_at desc;');

  const subject = vaultMissing.length > 0
    ? '[Fragment Tracker] CRITICAL: vault secrets missing'
    : transitions.raised.length > 0
      ? `[Fragment Tracker] ${transitions.raised.length} new alert(s)`
      : `[Fragment Tracker] ${transitions.resolved.length} alert(s) resolved`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        subject,
        text: lines.join('\n'),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log({ level: 'warn', event: 'email_send_failed', status: res.status, body: body.slice(0, 300) });
      return;
    }
    log({ level: 'info', event: 'email_sent', subject, raised: transitions.raised.length, resolved: transitions.resolved.length, vault_missing: vaultMissing.length });
  } catch (err) {
    log({ level: 'warn', event: 'email_exception', error: err instanceof Error ? err.message : String(err) });
  }
}

// ---------------------------------------------------------------------------
// Discord webhook notifier (optional)
// ---------------------------------------------------------------------------

function levelEmoji(level: AlertLevel): string {
  // Plain Unicode circles render reliably in both desktop and mobile Discord;
  // the colored-circle emojis don't get auto-replaced by Discord's emoji
  // shortcodes the way :red_circle: would, so the message body stays stable.
  switch (level) {
    case 'critical': return '🔴';
    case 'error': return '🟠';
    case 'warn': return '🟡';
    case 'info': return '🔵';
  }
}

async function notifyDiscord(transitions: Transitions, vaultMissing: OpenAlertRow[]): Promise<void> {
  const url = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!url) {
    if (transitions.raised.length + transitions.resolved.length + vaultMissing.length > 0) {
      log({ level: 'info', event: 'discord_skipped_no_config' });
    }
    return;
  }

  const interesting = transitions.raised.length + transitions.resolved.length + vaultMissing.length;
  if (interesting === 0) return;

  // Compose the embed description from up to three sections. We cap the per-
  // section line count at 10 with a "…and N more" trailer so a 24-firm WAF
  // outage doesn't blow Discord's 4096-char description limit.
  const sections: string[] = [];

  if (vaultMissing.length > 0) {
    const lines = vaultMissing.map((a) => `🔴 ${a.message}`);
    sections.push(`**CRITICAL — Vault secrets missing**\n${lines.join('\n')}`);
  }

  if (transitions.raised.length > 0) {
    const cap = 10;
    const lines = transitions.raised.slice(0, cap).map((a) =>
      `${levelEmoji(a.level)} \`${a.kind}\` ${a.message}`,
    );
    const more = transitions.raised.length > cap
      ? `\n…and ${transitions.raised.length - cap} more`
      : '';
    sections.push(`**🆕 New alerts (${transitions.raised.length})**\n${lines.join('\n')}${more}`);
  }

  if (transitions.resolved.length > 0) {
    const cap = 10;
    const lines = transitions.resolved.slice(0, cap).map((a) =>
      `🟢 \`${a.kind}\` ${a.message}`,
    );
    const more = transitions.resolved.length > cap
      ? `\n…and ${transitions.resolved.length - cap} more`
      : '';
    sections.push(`**✅ Resolved (${transitions.resolved.length})**\n${lines.join('\n')}${more}`);
  }

  let description = sections.join('\n\n');
  if (description.length > 4000) description = description.slice(0, 3990) + '\n…(truncated)';

  // Embed color: highest-severity transition wins. Critical (vault_missing) >
  // any raise > resolve-only. Discord ints are decimal RGB.
  const color = vaultMissing.length > 0
    ? 0xE74C3C // red
    : transitions.raised.length > 0
      ? 0xE67E22 // orange
      : 0x27AE60; // green

  const headlineKind = vaultMissing.length > 0
    ? 'CRITICAL'
    : transitions.raised.length > 0
      ? 'ALERTS'
      : 'RESOLVED';

  const payload = {
    username: 'Fragment Tracker Watchdog',
    embeds: [{
      title: `Watchdog — ${headlineKind}`,
      description,
      color,
      timestamp: new Date().toISOString(),
      footer: { text: 'select * from system_alerts where resolved_at is null;' },
    }],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log({ level: 'warn', event: 'discord_send_failed', status: res.status, body: body.slice(0, 300) });
      return;
    }
    log({
      level: 'info',
      event: 'discord_sent',
      raised: transitions.raised.length,
      resolved: transitions.resolved.length,
      vault_missing: vaultMissing.length,
    });
  } catch (err) {
    log({ level: 'warn', event: 'discord_exception', error: err instanceof Error ? err.message : String(err) });
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (_req) => {
  const startedAt = performance.now();
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const [firmErrors, firmZeroUk, fleetSilent, firmVolumeDrop] = await Promise.all([
      detectFirmErrors(supabase),
      detectFirmZeroUk(supabase),
      detectFleetSilent(supabase),
      detectFirmVolumeDrop(supabase),
    ]);

    const candidates = [...firmErrors, ...firmZeroUk, ...fleetSilent, ...firmVolumeDrop];
    const watchdogKinds: AlertKind[] = ['firm_errors', 'firm_zero_uk', 'fleet_silent', 'firm_volume_drop'];
    const openWatchdogAlerts = await loadOpenAlerts(supabase, watchdogKinds);
    const transitions = await reconcileAlerts(supabase, candidates, openWatchdogAlerts);

    // Vault-missing alerts are raised by _invoke_poller (plpgsql), not by us,
    // but if any are currently open the operator needs to know — include in
    // the email summary so a stuck pipeline doesn't go unnoticed past the
    // window when _invoke_poller first raised it.
    const { data: vaultRows } = await supabase
      .from('system_alerts')
      .select('id,kind,firm_id,message,raised_at')
      .eq('kind', 'vault_missing')
      .is('resolved_at', null);
    const vaultMissing = (vaultRows ?? []) as OpenAlertRow[];

    // Fan out to every configured sink in parallel. Each helper checks its
    // own env vars and no-ops silently when unconfigured; failures inside one
    // sink (network, 5xx) log a warning but don't fail the watchdog run.
    await Promise.all([
      notifyEmail(transitions, vaultMissing),
      notifyDiscord(transitions, vaultMissing),
    ]);

    const summary = {
      ok: true,
      ms: Math.round(performance.now() - startedAt),
      candidates: candidates.length,
      raised: transitions.raised.length,
      resolved: transitions.resolved.length,
      vault_missing_open: vaultMissing.length,
    };
    log({ event: 'run_complete', ...summary });
    return Response.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', event: 'watchdog_failed', error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
