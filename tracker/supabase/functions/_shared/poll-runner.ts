// Shared loop for ATS pollers that produce NormalizedPosting[] per firm.
// Responsibilities the runner owns:
//   1. Load active firms for this ATS type
//   2. Run each firm in parallel with a per-firm timeout
//   3. Apply the UK location filter via isUkLocation()
//   4. Classify each title into role_category + programme_type
//   5. Upsert on (firm_id, external_id) in a single round-trip
//   6. Close previously-open jobs not seen this run via close_stale_jobs RPC
//   7. Log structured JSON per firm + one run summary
//
// Per-firm DB cost = 2 round-trips (upsert + close RPC). All firms run in
// parallel via Promise.all, so the run wall-clock is dominated by the slowest
// fetch, not by DB writes.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classify } from './classify.ts';
import { isUkLocation } from './uk-locations.ts';
import { AtsConfigError } from './ats-config.ts';
import type { Fetcher, FirmResult, FirmRow } from './types.ts';

const DEFAULT_PER_FIRM_TIMEOUT_MS = 15_000;

interface RunSummary {
  firms: number;
  fetched: number;
  uk: number;
  upserted: number;
  closed: number;
  failed: number;
  ms: number;
  results: FirmResult[];
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

// Per-firm timeout. The previous version rejected the wrapping promise but did
// NOT abort the underlying fetch, so hung tenants tied up Deno isolate slots
// across overlapping cron invocations. We now thread an AbortController through
// to the fetcher (and to `fetch`) so the network request actually stops when
// the timeout fires.
function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  return run(ctrl.signal).finally(() => clearTimeout(timer));
}

async function processFirm(
  source: string,
  supabase: ReturnType<typeof createClient>,
  firm: FirmRow,
  fetcher: Fetcher,
  timeoutMs: number,
): Promise<FirmResult> {
  const startedAt = performance.now();
  try {
    const postings = await withTimeout((signal) => fetcher(firm, signal), timeoutMs, firm.slug);
    const fetched = postings.length;

    const ukPostings = postings.filter((p) => isUkLocation(p.searchText));

    // Build seen-set and dedupe rows by external_id in a single pass.
    //
    // Why dedupe: Postgres raises 21000 ("ON CONFLICT DO UPDATE cannot affect
    // row a second time") if the upsert array contains duplicate keys. Workday
    // pagination occasionally returns the same posting across pages and Lever
    // cross-lists roles under the same id. A single duplicate aborts the
    // whole upsert and the catch below marks the firm failed with seen={},
    // which previously triggered a mass close. We harden at three layers
    // (this dedupe + the seen-set retention below + the RPC sanity guard).
    //
    // Why we add to seenExternalIds even when skipping the row: a transient
    // missing-title from the ATS would otherwise drop the id from the seen
    // set and close_stale_jobs would close a still-live role.
    const seenExternalIds = new Set<string>();
    const rowsByExternalId = new Map<string, Record<string, unknown>>();
    for (const p of ukPostings) {
      if (!p.externalId) continue;
      seenExternalIds.add(p.externalId);
      if (!p.title || !p.applyUrl) continue;
      const { category, programme } = classify(p.title);
      rowsByExternalId.set(p.externalId, {
        firm_id: firm.id,
        external_id: p.externalId,
        title: p.title,
        location: p.location,
        apply_url: p.applyUrl,
        category,
        programme,
        posted_at: p.postedAt,
        raw: p.raw as unknown,
        // Reopen-on-detection: clear closed_at so a re-listed role becomes
        // visible again. The BEFORE UPDATE trigger added in migration 0007
        // re-stamps detected_at on the closed_at -> null transition, keeping
        // the "5 minute" freshness signal honest for reopened roles.
        closed_at: null,
      });
    }
    const rows = Array.from(rowsByExternalId.values());

    let upserted = 0;
    if (rows.length > 0) {
      // Single round-trip. We used to pre-SELECT existing external_ids just to
      // log inserted vs updated separately, but that ~100ms/firm round-trip
      // had no functional value -- a fresh insert and an update both mean
      // "this role is currently open" to the rest of the system.
      const { error: upsertErr } = await supabase.from('jobs').upsert(rows, {
        onConflict: 'firm_id,external_id',
        ignoreDuplicates: false,
      });
      if (upsertErr) throw new Error(`upsert jobs: ${upsertErr.message}`);
      upserted = rows.length;
    }

    // Single-round-trip close. The RPC runs:
    //   update jobs set closed_at = now()
    //   where firm_id = $1 and closed_at is null and external_id <> all($2)
    // returning the row count. Replaces a prior SELECT-then-UPDATE pair.
    const { data: closedCount, error: closeErr } = await supabase.rpc(
      'close_stale_jobs',
      { p_firm_id: firm.id, p_seen: Array.from(seenExternalIds) },
    );
    if (closeErr) throw new Error(`close stale: ${closeErr.message}`);
    // PostgREST returns bigint as a string (preserves precision for >2^53);
    // normalize to a finite Number for the result struct. Values realistically
    // fit in Number even at peak (tens of thousands of stale rows max).
    const closed = closedCount == null
      ? 0
      : typeof closedCount === 'number'
        ? closedCount
        : Number(closedCount as unknown as string);

    const result: FirmResult = {
      firm: firm.slug,
      fetched,
      uk: ukPostings.length,
      upserted,
      closed,
      ms: Math.round(performance.now() - startedAt),
    };
    log({ source, level: 'info', ...result });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: FirmResult = {
      firm: firm.slug,
      fetched: 0,
      uk: 0,
      upserted: 0,
      closed: 0,
      ms: Math.round(performance.now() - startedAt),
      error: message,
    };
    const level = err instanceof AtsConfigError ? 'error' : 'warn';
    log({ source, level, ...result });
    return result;
  }
}

interface RunOptions {
  source: string;        // log tag, e.g. "poll-greenhouse"
  atsType: string;       // matches firms.ats column, e.g. "greenhouse"
  fetcher: Fetcher;
  perFirmTimeoutMs?: number;
  // Maximum number of firms processed in parallel. Omit / leave undefined for
  // "all firms in parallel" (the original behavior) — that's right for ATSes
  // with per-tenant hosts (Greenhouse, Lever, SmartRecruiters) where each
  // firm has its own backend. Set a small value (e.g. 4) for ATSes where many
  // firms share a backend that rate-limits per source IP (Workday CXS), so a
  // big seed doesn't burst all 24+ firms simultaneously from one Edge IP and
  // trip the WAF for everyone.
  firmConcurrency?: number;
}

export async function runPoller(opts: RunOptions): Promise<RunSummary> {
  const { source, atsType, fetcher, perFirmTimeoutMs = DEFAULT_PER_FIRM_TIMEOUT_MS, firmConcurrency } = opts;
  const runStartedAt = performance.now();

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: firms, error } = await supabase
    .from('firms')
    .select('id,slug,name,ats,ats_config,active,next_run_after,consecutive_errors,last_error_at,last_success_at')
    .eq('ats', atsType)
    .eq('active', true);
  if (error) throw new Error(`load firms: ${error.message}`);

  // Tier-2 exponential backoff: skip firms whose next_run_after is in the
  // future. We filter client-side rather than pushing the predicate into the
  // PostgREST query because the clock comparison stays consistent with the
  // backoff arithmetic below (both use Date.now()).
  const allFirms = (firms ?? []) as (FirmRow & {
    next_run_after: string | null;
    consecutive_errors: number;
    last_error_at: string | null;
    last_success_at: string | null;
  })[];
  const nowMs = Date.now();
  const list = allFirms.filter(
    (f) => !f.next_run_after || new Date(f.next_run_after).getTime() <= nowMs,
  );
  const skippedInBackoff = allFirms.length - list.length;
  log({ source, event: 'run_start', firms: list.length, skipped_backoff: skippedInBackoff });

  // Default: unlimited (one Promise.all). When firmConcurrency is set, process
  // firms in fixed-size batches so we never have more than `firmConcurrency`
  // in-flight at once. The order within a batch is irrelevant; we preserve
  // the run-summary order via index.
  let results: FirmResult[];
  if (!firmConcurrency || firmConcurrency >= list.length) {
    results = await Promise.all(
      list.map((f) => processFirm(source, supabase, f, fetcher, perFirmTimeoutMs)),
    );
  } else {
    results = new Array<FirmResult>(list.length);
    for (let i = 0; i < list.length; i += firmConcurrency) {
      const batch = list.slice(i, i + firmConcurrency);
      const batchResults = await Promise.all(
        batch.map((f) => processFirm(source, supabase, f, fetcher, perFirmTimeoutMs)),
      );
      for (let j = 0; j < batchResults.length; j++) {
        results[i + j] = batchResults[j];
      }
    }
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.fetched += r.fetched;
      acc.uk += r.uk;
      acc.upserted += r.upserted;
      acc.closed += r.closed;
      if (r.error) acc.failed += 1;
      return acc;
    },
    { fetched: 0, uk: 0, upserted: 0, closed: 0, failed: 0 },
  );

  // Persist per-firm telemetry to poller_runs (Tier-0 observability). One
  // INSERT per run with N values; failure here MUST NOT abort the run, so the
  // catch logs structured JSON and continues. We map slug -> id via a lookup
  // built from `list` since FirmResult only carries the slug.
  const slugToId = new Map<string, string>();
  for (const f of list) slugToId.set(f.slug, f.id);
  const rows = results.map((r) => ({
    firm_id: slugToId.get(r.firm) ?? null,
    firm_slug: r.firm,
    source,
    fetched: r.fetched,
    uk: r.uk,
    upserted: r.upserted,
    closed: r.closed,
    ms: r.ms,
    error: r.error ?? null,
  }));
  if (rows.length > 0) {
    const { error: telemErr } = await supabase.from('poller_runs').insert(rows);
    if (telemErr) {
      log({ source, level: 'warn', event: 'poller_runs_insert_failed', error: telemErr.message });
    }
  }

  // Tier-2 backoff: update per-firm state (consecutive_errors, next_run_after,
  // last_error_at, last_success_at) in a single round-trip via RPC. The
  // backoff schedule lives here so the runner stays the single source of
  // truth; the SQL function is just bulk persistence.
  //
  // Schedule: 2, 4, 8, 16, 32, 60 (cap) minutes for consecutive errors 1..6+.
  // Success resets everything to defaults so a transient failure doesn't
  // suppress future runs once the firm recovers.
  const stateUpdates = results
    .map((r) => {
      const firm = list.find((f) => f.slug === r.firm);
      if (!firm) return null;
      if (r.error) {
        const newErrors = (firm.consecutive_errors ?? 0) + 1;
        const minutes = Math.min(2 ** newErrors, 60);
        const nextRunAfter = new Date(nowMs + minutes * 60_000).toISOString();
        return {
          id: firm.id,
          consecutive_errors: newErrors,
          next_run_after: nextRunAfter,
          last_error_at: new Date(nowMs).toISOString(),
          last_success_at: null,
        };
      }
      return {
        id: firm.id,
        consecutive_errors: 0,
        next_run_after: null,
        last_error_at: null,
        last_success_at: new Date(nowMs).toISOString(),
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (stateUpdates.length > 0) {
    const { error: stateErr } = await supabase.rpc('update_firm_run_states', {
      p_updates: stateUpdates,
    });
    if (stateErr) {
      log({ source, level: 'warn', event: 'firm_state_update_failed', error: stateErr.message });
    }
  }

  const summary: RunSummary = {
    firms: list.length,
    ms: Math.round(performance.now() - runStartedAt),
    ...totals,
    results,
  };

  log({ source, event: 'run_complete', firms: summary.firms, ms: summary.ms, ...totals });
  return summary;
}
