// poll-host-probe. Tier-2B auto-recovery: once a day, probe every inactive
// firm's careers_url. If DNS resolves AND the URL returns 200, raise a
// firm_recovery_ready alert so the operator can re-verify and reactivate.
//
// Cron: 03:00 UTC daily (before the 04:00 poller_runs prune, after the
// last European business-hours updates). The probe is read-only on every
// external host (only HEAD/GET, no writes), and runs once per inactive
// firm — total fan-out today is < 10 firms.
//
// Idempotency:
//   - Raise via INSERT...except-on-unique. system_alerts partial unique
//     index ensures at most one open firm_recovery_ready per firm at any
//     time. If the alert is already open, this is a cheap no-op.
//   - The alert clears manually: when the operator re-verifies the config
//     and sets active=true, they should resolve the alert in the same step
//     (or the watchdog catches the firm running successfully and stays
//     silent — recovery_ready resolution is operator-driven for now).
//
// What we do NOT do:
//   - Auto-reactivate. Coming back online doesn't mean the seeded config
//     is still correct. HSBC's mycareer.hsbc.com might return 200 while
//     having migrated all candidate flow to portal.careers.hsbc.com. The
//     human verification step is intentional.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface InactiveFirm {
  id: string;
  slug: string;
  name: string;
  careers_url: string | null;
  ats: string;
}

interface ProbeResult {
  firm: InactiveFirm;
  reachable: boolean;
  http_status: number | null;
  error: string | null;
  ms: number;
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'poll-host-probe', ...payload }));
}

async function probeOne(firm: InactiveFirm): Promise<ProbeResult> {
  const startedAt = performance.now();
  if (!firm.careers_url) {
    return {
      firm,
      reachable: false,
      http_status: null,
      error: 'no_careers_url',
      ms: Math.round(performance.now() - startedAt),
    };
  }
  // HEAD first; many CDN-fronted sites reject HEAD or return 405, so fall
  // back to GET with a short read budget. The GET reads up to ~64 KB of
  // headers then drops the body — we only care about the status line.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('probe timeout')), 8_000);
  try {
    let res = await fetch(firm.careers_url, {
      method: 'HEAD',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
    if (res.status === 405 || res.status === 501) {
      // Method not allowed — retry as GET.
      res = await fetch(firm.careers_url, {
        method: 'GET',
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });
      // Drain the body to release the connection promptly.
      await res.body?.cancel();
    } else {
      await res.body?.cancel();
    }
    return {
      firm,
      reachable: res.ok,
      http_status: res.status,
      error: res.ok ? null : `HTTP_${res.status}`,
      ms: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      firm,
      reachable: false,
      http_status: null,
      // DNS lookups failures and connection resets look identical from Deno's
      // fetch error message; we capture whatever Deno hands us so the alert
      // detail tells the operator what they need.
      error: message.slice(0, 300),
      ms: Math.round(performance.now() - startedAt),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function raiseRecoveryAlert(
  supabase: SupabaseClient,
  result: ProbeResult,
): Promise<'raised' | 'already_open' | 'failed'> {
  const { error } = await supabase.from('system_alerts').insert({
    level: 'info',
    kind: 'firm_recovery_ready',
    firm_id: result.firm.id,
    message: `${result.firm.slug} appears reachable again (HTTP ${result.http_status}) — re-verify ATS config and reactivate`,
    detail: {
      careers_url: result.firm.careers_url,
      ats: result.firm.ats,
      http_status: result.http_status,
      probe_ms: result.ms,
    },
  });
  if (!error) return 'raised';
  if (/duplicate key|unique constraint/i.test(error.message)) return 'already_open';
  log({ level: 'warn', event: 'recovery_alert_insert_failed', firm: result.firm.slug, error: error.message });
  return 'failed';
}

async function resolveRecoveryAlerts(
  supabase: SupabaseClient,
  unreachableFirmIds: string[],
): Promise<number> {
  // If a firm was previously flagged firm_recovery_ready but is now
  // unreachable again, resolve the alert so the operator doesn't see a
  // stale "reactivate me" prompt. The alert can re-raise tomorrow if the
  // host comes back.
  if (unreachableFirmIds.length === 0) return 0;
  const { error, count } = await supabase
    .from('system_alerts')
    .update({ resolved_at: new Date().toISOString() }, { count: 'exact' })
    .eq('kind', 'firm_recovery_ready')
    .is('resolved_at', null)
    .in('firm_id', unreachableFirmIds);
  if (error) {
    log({ level: 'warn', event: 'recovery_alert_resolve_failed', error: error.message });
    return 0;
  }
  return count ?? 0;
}

Deno.serve(async (_req) => {
  const startedAt = performance.now();
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: firms, error } = await supabase
      .from('firms')
      .select('id,slug,name,careers_url,ats')
      .eq('active', false)
      .not('careers_url', 'is', null);
    if (error) throw new Error(`load inactive firms: ${error.message}`);

    const list = (firms ?? []) as InactiveFirm[];
    log({ event: 'probe_start', inactive_firms: list.length });

    // 4 in parallel is enough — the entire batch is small and the bottleneck
    // is per-host latency, not throughput.
    const results: ProbeResult[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const batch = list.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(probeOne));
      results.push(...batchResults);
    }

    let raised = 0;
    let alreadyOpen = 0;
    const unreachableIds: string[] = [];
    for (const r of results) {
      if (r.reachable) {
        const outcome = await raiseRecoveryAlert(supabase, r);
        if (outcome === 'raised') raised += 1;
        else if (outcome === 'already_open') alreadyOpen += 1;
      } else {
        unreachableIds.push(r.firm.id);
      }
    }
    const resolved = await resolveRecoveryAlerts(supabase, unreachableIds);

    const summary = {
      ok: true,
      ms: Math.round(performance.now() - startedAt),
      probed: list.length,
      reachable: results.filter((r) => r.reachable).length,
      raised,
      already_open: alreadyOpen,
      resolved,
    };
    log({ event: 'probe_complete', ...summary });
    return Response.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', event: 'probe_failed', error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
