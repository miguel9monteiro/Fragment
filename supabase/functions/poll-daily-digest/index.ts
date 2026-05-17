// poll-daily-digest. Rolls up the last 24 hours into a structured summary,
// persists to daily_digests (one row per London-local date, idempotent),
// renders a plain-text body, and optionally pushes to email + Discord.
//
// Cron: 06:00 UTC daily. In London that's 07:00 BST (summer) or 06:00 GMT
// (winter) — accepting the 1h shift across DST instead of running two cron
// entries and dedupe-via-row.
//
// Sinks (independent — set whichever env vars are configured):
//   RESEND_API_KEY + ALERT_EMAIL_TO   -> email via Resend
//   DISCORD_WEBHOOK_URL               -> Discord embed
// If none are configured, the digest still lands in daily_digests and the
// function returns 200. Sinks fire in parallel and any one failing logs a
// warning without aborting the run.
//
// Why a rolling 24h window instead of "yesterday 00:00 London → today 00:00":
// the generator fires at 06:00 UTC. A strict "yesterday" window would miss
// roles posted between yesterday-end and now — exactly the freshest signal
// the user cares about. The rolling window captures the latest 24h up to
// the moment the digest runs.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface JobRow {
  id: string;
  title: string;
  category: string;
  programme: string;
  detected_at: string;
  created_at: string;
  firm: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

interface PollerRunRow {
  source: string;
  firm_slug: string | null;
  fetched: number;
  uk: number;
  upserted: number;
  closed: number;
  error: string | null;
  ran_at: string;
}

interface AlertRow {
  kind: string;
  level: string;
  firm_id: string | null;
  message: string;
  raised_at: string;
  resolved_at: string | null;
}

type Counts = Record<string, number>;

interface DigestSummary {
  digest_date: string;
  window: { from: string; to: string };
  ingest: {
    new_jobs: number;
    by_category: Counts;
    by_programme: Counts;
    by_firm: Counts;
  };
  fleet: {
    poller_runs: number;
    poller_runs_errored: number;
    sources: Record<string, { runs: number; errs: number; upserts: number; uk: number }>;
    active_firms: number;
  };
  alerts: {
    open: number;
    by_kind: Counts;
    new_24h: number;
    resolved_24h: number;
  };
  top_new_roles: Array<{
    title: string;
    firm: string;
    category: string;
    programme: string;
    detected_at: string;
  }>;
  top_erroring: Array<{
    firm_slug: string;
    source: string;
    consecutive_errors: number;
    latest_error: string;
  }>;
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'poll-daily-digest', ...payload }));
}

function firmOf(rel: JobRow['firm']): { slug: string; name: string } | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// "Today" in London-local time as a YYYY-MM-DD string. Used for the unique
// constraint on daily_digests.
function londonDateToday(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

// We use only the canonical role categories the UI shows on /jobs, in the
// same display order, so the digest reads in the same shape the user already
// recognises. (programme labels live in the function rendering, not here.)
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
  other: 'Other',
};

const PROGRAMME_LABELS: Record<string, string> = {
  spring_week: 'Spring Week',
  summer_internship: 'Summer Internship',
  off_cycle_internship: 'Off-cycle Internship',
  industrial_placement: 'Industrial Placement',
  graduate: 'Graduate',
  entry_level: 'Entry Level',
  mid_level: 'Mid Level',
  senior: 'Senior',
  experienced: 'Experienced',
  unknown: 'Unspecified',
};

// Priority order for the "top new roles" picker. Internships + grad +
// entry-level rank highest because they're the wedge audience (UK finance
// students); senior roles drop to the bottom.
const PROGRAMME_PRIORITY: Record<string, number> = {
  spring_week: 1,
  summer_internship: 2,
  off_cycle_internship: 3,
  industrial_placement: 4,
  graduate: 5,
  entry_level: 6,
  mid_level: 7,
  senior: 8,
  experienced: 9,
  unknown: 10,
};

async function collectIngest(supabase: SupabaseClient): Promise<{
  jobs: JobRow[];
  byCategory: Counts;
  byProgramme: Counts;
  byFirm: Counts;
}> {
  // Last 24h of newly-created jobs. We use created_at (insert time), not
  // detected_at (which can be re-stamped by the reopen-on-detection trigger
  // and over-count a single re-listing).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('jobs')
    .select('id,title,category,programme,detected_at,created_at,firm:firms(slug,name)')
    .gte('created_at', since)
    .limit(5000);
  if (error) throw new Error(`collectIngest: ${error.message}`);

  const jobs = (data ?? []) as unknown as JobRow[];
  const byCategory: Counts = {};
  const byProgramme: Counts = {};
  const byFirm: Counts = {};
  for (const j of jobs) {
    byCategory[j.category] = (byCategory[j.category] ?? 0) + 1;
    byProgramme[j.programme] = (byProgramme[j.programme] ?? 0) + 1;
    const firm = firmOf(j.firm);
    if (firm) byFirm[firm.slug] = (byFirm[firm.slug] ?? 0) + 1;
  }
  return { jobs, byCategory, byProgramme, byFirm };
}

async function collectFleet(supabase: SupabaseClient): Promise<{
  poller_runs: number;
  poller_runs_errored: number;
  sources: Record<string, { runs: number; errs: number; upserts: number; uk: number }>;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // We aggregate client-side because the row count (~10s of thousands per
  // day) is small enough that the wire cost is negligible, and writing a
  // dedicated RPC for one query in one function isn't worth the migration
  // weight. If poller_runs grows materially, swap to an RPC.
  const { data, error } = await supabase
    .from('poller_runs')
    .select('source,fetched,uk,upserted,error,ran_at')
    .gte('ran_at', since)
    .limit(200_000);
  if (error) throw new Error(`collectFleet: ${error.message}`);

  let total = 0;
  let totalErrs = 0;
  const sources: Record<string, { runs: number; errs: number; upserts: number; uk: number }> = {};
  for (const row of (data ?? []) as PollerRunRow[]) {
    total += 1;
    if (row.error) totalErrs += 1;
    const s = sources[row.source] ?? { runs: 0, errs: 0, upserts: 0, uk: 0 };
    s.runs += 1;
    if (row.error) s.errs += 1;
    s.upserts += row.upserted ?? 0;
    s.uk += row.uk ?? 0;
    sources[row.source] = s;
  }
  return { poller_runs: total, poller_runs_errored: totalErrs, sources };
}

async function collectActiveFirms(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('firms')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);
  if (error) throw new Error(`collectActiveFirms: ${error.message}`);
  return count ?? 0;
}

async function collectAlerts(supabase: SupabaseClient): Promise<{
  open: number;
  by_kind: Counts;
  new_24h: number;
  resolved_24h: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Three queries (open, raised-in-window, resolved-in-window) instead of
  // one big query so we avoid pulling the full alert history on every run.
  const [openRes, raisedRes, resolvedRes] = await Promise.all([
    supabase
      .from('system_alerts')
      .select('kind,level,firm_id,message,raised_at,resolved_at')
      .is('resolved_at', null),
    supabase
      .from('system_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('raised_at', since),
    supabase
      .from('system_alerts')
      .select('id', { count: 'exact', head: true })
      .gte('resolved_at', since),
  ]);
  if (openRes.error) throw new Error(`alerts open: ${openRes.error.message}`);
  if (raisedRes.error) throw new Error(`alerts raised: ${raisedRes.error.message}`);
  if (resolvedRes.error) throw new Error(`alerts resolved: ${resolvedRes.error.message}`);

  const open = (openRes.data ?? []) as AlertRow[];
  const by_kind: Counts = {};
  for (const a of open) by_kind[a.kind] = (by_kind[a.kind] ?? 0) + 1;
  return {
    open: open.length,
    by_kind,
    new_24h: raisedRes.count ?? 0,
    resolved_24h: resolvedRes.count ?? 0,
  };
}

async function collectTopErroring(supabase: SupabaseClient): Promise<DigestSummary['top_erroring']> {
  // Pull last 60 min of runs, group by (firm, source), count consecutive
  // errors from the most recent row. This is the same logic the watchdog
  // uses for firm_errors, but with the threshold lowered to 1 (we want
  // even single recent errors visible in the digest).
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('poller_runs')
    .select('firm_slug,source,error,ran_at')
    .gte('ran_at', since)
    .not('firm_id', 'is', null)
    .order('ran_at', { ascending: false })
    .limit(10_000);
  if (error) throw new Error(`collectTopErroring: ${error.message}`);

  const grouped = new Map<string, { firm_slug: string; source: string; consec: number; latest: string }>();
  for (const row of (data ?? []) as PollerRunRow[]) {
    if (!row.firm_slug) continue;
    const key = `${row.firm_slug}::${row.source}`;
    const cur = grouped.get(key);
    if (!cur) {
      // First (most-recent) row for this key.
      grouped.set(key, {
        firm_slug: row.firm_slug,
        source: row.source,
        consec: row.error ? 1 : 0,
        latest: row.error ?? '',
      });
      continue;
    }
    // Stop counting once we hit a success — only consecutive failures from
    // the tail are interesting for the digest.
    if (cur.consec === 0 || cur.latest === '') continue;
    if (row.error) cur.consec += 1;
    else cur.latest = cur.latest; // keep latest stamped
  }

  const out = Array.from(grouped.values())
    .filter((g) => g.consec >= 3)
    .sort((a, b) => b.consec - a.consec)
    .slice(0, 5)
    .map((g) => ({
      firm_slug: g.firm_slug,
      source: g.source,
      consecutive_errors: g.consec,
      latest_error: g.latest.slice(0, 200),
    }));
  return out;
}

function pickTopNewRoles(jobs: JobRow[]): DigestSummary['top_new_roles'] {
  // Sort by (programme priority asc, detected_at desc) — high-priority
  // tenures first, freshest within each tier.
  const enriched = jobs.map((j) => {
    const firm = firmOf(j.firm);
    return {
      job: j,
      priority: PROGRAMME_PRIORITY[j.programme] ?? 99,
      firm_slug: firm?.slug ?? '',
      firm_name: firm?.name ?? '',
    };
  });
  enriched.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.job.detected_at.localeCompare(a.job.detected_at);
  });
  return enriched.slice(0, 8).map((e) => ({
    title: e.job.title,
    firm: e.firm_name || e.firm_slug,
    category: e.job.category,
    programme: e.job.programme,
    detected_at: e.job.detected_at,
  }));
}

// ---------------------------------------------------------------------------
// Renderer (plain text)
// ---------------------------------------------------------------------------

function renderText(s: DigestSummary): string {
  const lines: string[] = [];
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  lines.push(`Fragment Tracker — Daily Digest, ${s.digest_date}`);
  lines.push('='.repeat(50));
  lines.push('');

  lines.push(`INGEST (last 24h)`);
  lines.push(`  ${s.ingest.new_jobs} new UK roles ingested`);
  lines.push('');

  if (Object.keys(s.ingest.by_category).length > 0) {
    lines.push(`BY SUB-VERTICAL`);
    const sorted = Object.entries(s.ingest.by_category).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sorted) {
      lines.push(`  ${(CATEGORY_LABELS[k] ?? k).padEnd(24)} ${v}`);
    }
    lines.push('');
  }

  if (Object.keys(s.ingest.by_programme).length > 0) {
    lines.push(`BY TENURE`);
    // Sort by display order, not by count, so the ladder reads top-to-bottom
    // in the same shape the /jobs filter chips show it.
    const order = Object.keys(PROGRAMME_PRIORITY);
    for (const k of order) {
      const n = s.ingest.by_programme[k];
      if (!n) continue;
      lines.push(`  ${(PROGRAMME_LABELS[k] ?? k).padEnd(24)} ${n}`);
    }
    lines.push('');
  }

  if (s.top_new_roles.length > 0) {
    lines.push(`TOP NEW ROLES (internships + grad + entry-level first)`);
    let i = 1;
    for (const r of s.top_new_roles) {
      const tags = [
        CATEGORY_LABELS[r.category] ?? r.category,
        PROGRAMME_LABELS[r.programme] ?? r.programme,
      ].filter(Boolean).join(' · ');
      lines.push(`  ${i}. ${r.firm} — ${r.title}`);
      lines.push(`     ${tags} · detected ${fmtTime(r.detected_at)}`);
      i++;
    }
    lines.push('');
  }

  lines.push(`FLEET HEALTH (last 24h)`);
  lines.push(`  ${s.fleet.active_firms} active firms`);
  lines.push(`  ${s.fleet.poller_runs} poller runs, ${s.fleet.poller_runs_errored} errored`);
  for (const [source, m] of Object.entries(s.fleet.sources).sort()) {
    const errPct = m.runs > 0 ? Math.round((m.errs / m.runs) * 100) : 0;
    lines.push(`  ${source.padEnd(22)} runs=${m.runs.toString().padStart(4)} errs=${m.errs.toString().padStart(4)} (${errPct}%) upserts=${m.upserts}`);
  }
  lines.push('');

  lines.push(`ALERTS`);
  lines.push(`  ${s.alerts.open} open · ${s.alerts.new_24h} new today · ${s.alerts.resolved_24h} resolved today`);
  for (const [kind, n] of Object.entries(s.alerts.by_kind).sort()) {
    lines.push(`  ${kind.padEnd(20)} ${n}`);
  }
  if (s.top_erroring.length > 0) {
    lines.push('');
    lines.push(`  Top erroring firms:`);
    for (const e of s.top_erroring) {
      lines.push(`  - ${e.firm_slug} (${e.source}): ${e.consecutive_errors} consecutive errors`);
      lines.push(`    ${e.latest_error}`);
    }
  }
  lines.push('');

  lines.push(`---`);
  lines.push(`Full payload: select summary from daily_digests where digest_date = '${s.digest_date}';`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

async function sendEmail(text: string, digestDate: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ALERT_EMAIL_TO');
  const from = Deno.env.get('ALERT_EMAIL_FROM') ?? 'onboarding@resend.dev';
  if (!apiKey || !to) {
    log({ level: 'info', event: 'email_skipped_no_config' });
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        subject: `[Fragment Tracker] Daily digest — ${digestDate}`,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log({ level: 'warn', event: 'email_send_failed', status: res.status, body: body.slice(0, 300) });
      return false;
    }
    log({ level: 'info', event: 'email_sent', digest_date: digestDate });
    return true;
  } catch (err) {
    log({ level: 'warn', event: 'email_exception', error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

async function sendDiscord(text: string, summary: DigestSummary): Promise<boolean> {
  const url = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!url) {
    log({ level: 'info', event: 'discord_skipped_no_config' });
    return false;
  }
  // Discord embed description limit: 4096 chars. Text body is usually well
  // under that, but truncate defensively.
  const description = text.length > 4000 ? text.slice(0, 3990) + '\n…(truncated)' : text;
  // Color encodes "is the fleet healthy today?" — green if zero open alerts
  // and zero erroring firms, yellow if alerts but ingestion happened,
  // orange/red if fleet is in trouble.
  const color = summary.alerts.open === 0 && summary.top_erroring.length === 0
    ? 0x27AE60 // green
    : summary.ingest.new_jobs > 0
      ? 0xF1C40F // yellow
      : 0xE74C3C; // red

  const payload = {
    username: 'Fragment Tracker',
    embeds: [{
      title: `Daily digest — ${summary.digest_date}`,
      description,
      color,
      timestamp: new Date().toISOString(),
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
      return false;
    }
    log({ level: 'info', event: 'discord_sent', digest_date: summary.digest_date });
    return true;
  } catch (err) {
    log({ level: 'warn', event: 'discord_exception', error: err instanceof Error ? err.message : String(err) });
    return false;
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

    const digestDate = londonDateToday();

    // Idempotency check: if today's digest already exists, return early.
    // This makes manual re-invocations cheap and protects against double-
    // firing if the cron schedule is ever doubled up.
    const { data: existing } = await supabase
      .from('daily_digests')
      .select('id,sent_via,generated_at')
      .eq('digest_date', digestDate)
      .maybeSingle();
    if (existing) {
      log({ event: 'digest_already_generated', digest_date: digestDate, sent_via: existing.sent_via });
      return Response.json({ ok: true, digest_date: digestDate, status: 'already_generated', sent_via: existing.sent_via });
    }

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [ingest, fleet, activeFirms, alerts, topErroring] = await Promise.all([
      collectIngest(supabase),
      collectFleet(supabase),
      collectActiveFirms(supabase),
      collectAlerts(supabase),
      collectTopErroring(supabase),
    ]);

    const summary: DigestSummary = {
      digest_date: digestDate,
      window: { from: since.toISOString(), to: now.toISOString() },
      ingest: {
        new_jobs: ingest.jobs.length,
        by_category: ingest.byCategory,
        by_programme: ingest.byProgramme,
        by_firm: ingest.byFirm,
      },
      fleet: {
        poller_runs: fleet.poller_runs,
        poller_runs_errored: fleet.poller_runs_errored,
        sources: fleet.sources,
        active_firms: activeFirms,
      },
      alerts,
      top_new_roles: pickTopNewRoles(ingest.jobs),
      top_erroring: topErroring,
    };

    const renderedText = renderText(summary);

    // Push first, persist after — so sent_via reflects reality. If push
    // fails the row still lands with sent_via=[] and the operator can
    // see what was rendered.
    const [emailSent, discordSent] = await Promise.all([
      sendEmail(renderedText, digestDate),
      sendDiscord(renderedText, summary),
    ]);
    const sentVia: string[] = [];
    if (emailSent) sentVia.push('email');
    if (discordSent) sentVia.push('discord');

    const { error: insertErr } = await supabase
      .from('daily_digests')
      .insert({
        digest_date: digestDate,
        summary,
        rendered_text: renderedText,
        sent_via: sentVia,
      });
    if (insertErr && !/duplicate key|unique constraint/i.test(insertErr.message)) {
      throw new Error(`daily_digests insert: ${insertErr.message}`);
    }

    const out = {
      ok: true,
      digest_date: digestDate,
      ms: Math.round(performance.now() - startedAt),
      new_jobs: summary.ingest.new_jobs,
      open_alerts: summary.alerts.open,
      sent_via: sentVia,
    };
    log({ event: 'digest_complete', ...out });
    return Response.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', event: 'digest_failed', error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
