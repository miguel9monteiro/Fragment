// poll-careers-scan. Tier-3B drift detection. Once a week (Saturday 02:00
// UTC), fetch every active firm's marketing careers_url, extract a set of
// ATS-vendor signals from the HTML, hash the signal set, and diff against
// the previous snapshot. When the signal set CHANGES (new ATS vendor
// appears, or an existing one disappears), raise a firm_careers_drift
// alert. This is the layer that catches "HSBC just put a banner pointing
// at portal.careers.hsbc.com (Eightfold)" before our Avature adapter starts
// silently failing.
//
// Why content hash alone is insufficient: marketing pages flicker
// (current-job-count badges, A/B-tested hero copy, CSRF tokens). A naive
// hash trips false positives constantly. The signal-set abstraction is
// stable across normal updates because the underlying ATS vendor doesn't
// change in normal operations — only in genuine migrations.
//
// We intentionally do NOT crawl beyond the careers_url. The firm's
// landing-page-style careers page is where migrations get announced
// (banners, redirects, menu links). One HTTP GET per firm per week is
// enough; cost is ~50 calls/week fleet-wide.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface FirmRow {
  id: string;
  slug: string;
  name: string;
  careers_url: string | null;
}

interface ScanResult {
  firm: FirmRow;
  ok: boolean;
  status_code: number | null;
  content_hash: string | null;
  external_hosts: string[];
  ats_signals: string[];
  signals_hash: string | null;
  fetched_url: string;
  error: string | null;
  ms: number;
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'poll-careers-scan', ...payload }));
}

// ---------------------------------------------------------------------------
// ATS-vendor signal map
// ---------------------------------------------------------------------------
// Each entry: (substring to look for in URLs / body text, canonical vendor
// name). The vendor name matches the firms.ats enum where possible so the
// drift diff is directly actionable ("careers page mentions 'eightfold'
// but firm.ats = 'avature' — re-research"). Multiple substrings can map to
// the same vendor (e.g. wd1.myworkdayjobs / wd3.myworkdayjobs / etc) so a
// new Workday data center doesn't trip a false-positive drift.
//
// Long-form first to avoid 'tal' matching inside 'taleo' or 'avature.net'
// matching inside 'recruitment.macquarie.com' (which uses Avature but on a
// vanity domain — we still surface 'avature' via the body-text scan).

interface VendorPattern {
  pattern: RegExp;
  vendor: string;
}

const VENDOR_PATTERNS: VendorPattern[] = [
  // Workday — multi-datacentre hosts.
  { pattern: /\bwd[0-9]+\.myworkdayjobs\.com/i, vendor: 'workday' },
  { pattern: /\bmyworkdayjobs\.com/i, vendor: 'workday' },
  { pattern: /\bworkday\.com/i, vendor: 'workday' },
  // Greenhouse — board hosts and "powered by Greenhouse" copy.
  { pattern: /\bboards(?:-api)?\.greenhouse\.io/i, vendor: 'greenhouse' },
  { pattern: /\bjob-boards\.greenhouse\.io/i, vendor: 'greenhouse' },
  { pattern: /\bgreenhouse\.io/i, vendor: 'greenhouse' },
  { pattern: /powered\s+by\s+greenhouse/i, vendor: 'greenhouse' },
  // Lever.
  { pattern: /\bjobs\.lever\.co/i, vendor: 'lever' },
  { pattern: /\bapi\.lever\.co/i, vendor: 'lever' },
  { pattern: /\blever\.co/i, vendor: 'lever' },
  // Workable.
  { pattern: /\bapply\.workable\.com/i, vendor: 'workable' },
  { pattern: /\bworkable\.com/i, vendor: 'workable' },
  // TeamTailor.
  { pattern: /\bteamtailor\.com/i, vendor: 'teamtailor' },
  // SmartRecruiters.
  { pattern: /\bcareers\.smartrecruiters\.com/i, vendor: 'smartrecruiters' },
  { pattern: /\bsmartrecruiters\.com/i, vendor: 'smartrecruiters' },
  // Oracle HCM Cloud Recruiting.
  { pattern: /\bfa\.oraclecloud\.com/i, vendor: 'oracle_hcm' },
  { pattern: /\boraclecloud\.com\/hcm/i, vendor: 'oracle_hcm' },
  // Oleeo / Lumesse — *.tal.net.
  { pattern: /\b[a-z0-9-]+\.tal\.net/i, vendor: 'oleeo' },
  // Avature — both *.avature.net AND vanity-domain "Avature" string in body.
  { pattern: /\bavature\.net/i, vendor: 'avature' },
  { pattern: /\bavature\b/i, vendor: 'avature' },
  // Eightfold.
  { pattern: /\beightfold\.ai/i, vendor: 'eightfold' },
  { pattern: /\beightfold\b/i, vendor: 'eightfold' },
  // Taleo Career Sections.
  { pattern: /\btaleo\.net/i, vendor: 'taleo' },
  { pattern: /\btgnewui\b/i, vendor: 'taleo' },
  // iCIMS.
  { pattern: /\bicims\.com/i, vendor: 'icims' },
  // SAP SuccessFactors.
  { pattern: /\bsuccessfactors\.(?:eu|com)/i, vendor: 'successfactors' },
  // Recruitee (GP Bullhound).
  { pattern: /\brecruitee\.com/i, vendor: 'recruitee' },
  // Trakstar Hire (Arma Partners).
  { pattern: /\bhire\.trakstar\.com/i, vendor: 'trakstar' },
  { pattern: /\btrakstar\b/i, vendor: 'trakstar' },
  // Cegid Talentsoft (Crédit Agricole CIB).
  { pattern: /\btalent-soft\.com/i, vendor: 'talentsoft' },
  // Inrecruiting / Intervieweb (Mediobanca).
  { pattern: /\bintervieweb\.it/i, vendor: 'inrecruiting' },
];

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// HTML parsing — minimal regex-based extraction
// ---------------------------------------------------------------------------
// We don't bring in deno-dom for ~50 weekly fetches; regex over href/src/
// action attributes is good enough for what we need (distinct host
// extraction + vendor pattern matching).

function extractAttributeValues(html: string): string[] {
  // Match href="...", href='...', src="...", action="..." etc. Collect the
  // raw attr value strings; we resolve absolute URLs from them downstream.
  const out: string[] = [];
  const re = /\b(?:href|src|action|data-href|data-url)=["']([^"']{2,300})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function eTldPlusOne(host: string): string {
  // Naive eTLD+1: take last two labels. Good enough for distinguishing
  // "hsbc.com" from "portal.careers.hsbc.com" — both reduce to "hsbc.com" —
  // and from "eightfold.ai" — reduces to "eightfold.ai". Doesn't handle
  // composite eTLDs like ".co.uk" perfectly (rothschildandco.com is fine
  // but news.bbc.co.uk -> bbc.co.uk which is what we want, vs naively
  // co.uk; correct outcome by accident). The downstream comparison treats
  // any difference as "external", so the trade-off is conservative.
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host.toLowerCase();
  const tld = parts[parts.length - 1].toLowerCase();
  // Compound-TLD detection — only the common UK / AU / NZ patterns we'd
  // see in a finance-careers context. Beyond these we accept the
  // false-positives.
  const last = parts[parts.length - 2].toLowerCase();
  const compound = ['co', 'gov', 'org', 'ac', 'net'].includes(last) &&
    ['uk', 'au', 'nz', 'jp', 'in'].includes(tld);
  if (compound && parts.length >= 3) {
    return parts.slice(-3).join('.').toLowerCase();
  }
  return parts.slice(-2).join('.').toLowerCase();
}

function hostsFromAttrs(attrs: string[], pageOrigin: string): string[] {
  const ownETLD = eTldPlusOne(new URL(pageOrigin).hostname);
  const set = new Set<string>();
  for (const v of attrs) {
    let host: string | null = null;
    try {
      // Resolve relative URLs against the page origin; skip anchors and
      // javascript: pseudo-protocols.
      if (v.startsWith('#') || v.toLowerCase().startsWith('javascript:')) continue;
      const u = new URL(v, pageOrigin);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      host = u.hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!host) continue;
    if (eTldPlusOne(host) === ownETLD) continue;
    set.add(host);
  }
  return Array.from(set).sort();
}

function matchVendorSignals(haystack: string): string[] {
  // Deduplicate by vendor name — multiple patterns can map to the same
  // vendor (Workday's many wd<N> datacentres, Greenhouse's many host
  // variants, etc) and we only want one entry per vendor in the snapshot.
  const set = new Set<string>();
  for (const { pattern, vendor } of VENDOR_PATTERNS) {
    if (pattern.test(haystack)) set.add(vendor);
  }
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// Scan one firm
// ---------------------------------------------------------------------------

async function scanFirm(firm: FirmRow): Promise<ScanResult> {
  const startedAt = performance.now();
  const blank: ScanResult = {
    firm,
    ok: false,
    status_code: null,
    content_hash: null,
    external_hosts: [],
    ats_signals: [],
    signals_hash: null,
    fetched_url: firm.careers_url ?? '',
    error: null,
    ms: 0,
  };
  if (!firm.careers_url) {
    return { ...blank, error: 'no_careers_url', ms: Math.round(performance.now() - startedAt) };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('scan timeout')), 12_000);
  try {
    const res = await fetch(firm.careers_url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
    const finalUrl = res.url || firm.careers_url;
    if (!res.ok) {
      return {
        ...blank,
        status_code: res.status,
        fetched_url: finalUrl,
        error: `HTTP_${res.status}`,
        ms: Math.round(performance.now() - startedAt),
      };
    }
    // Cap body read at ~512 KB. Marketing careers pages are 50-300 KB; the
    // cap protects against an unbounded body and keeps the SHA-256 fast.
    const text = await res.text();
    const body = text.length > 524_288 ? text.slice(0, 524_288) : text;

    const attrs = extractAttributeValues(body);
    const externalHosts = hostsFromAttrs(attrs, finalUrl);
    // Match vendor signals against the URL list AND the visible body. The
    // body scan catches "powered by Greenhouse" style markers that aren't
    // in URLs.
    const haystack = [externalHosts.join(' '), body].join(' ');
    const atsSignals = matchVendorSignals(haystack);

    const contentHash = await sha256Hex(body);
    const signalsHash = await sha256Hex([
      ...externalHosts,
      '||',
      ...atsSignals,
    ].join(' '));

    return {
      firm,
      ok: true,
      status_code: res.status,
      content_hash: contentHash,
      external_hosts: externalHosts,
      ats_signals: atsSignals,
      signals_hash: signalsHash,
      fetched_url: finalUrl,
      error: null,
      ms: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    return {
      ...blank,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      ms: Math.round(performance.now() - startedAt),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Persist + raise drift alert
// ---------------------------------------------------------------------------

interface PrevSnapshot {
  signals_hash: string | null;
  external_hosts: string[];
  ats_signals: string[];
  snapshot_at: string;
}

async function lastSnapshot(supabase: SupabaseClient, firmId: string): Promise<PrevSnapshot | null> {
  const { data } = await supabase
    .from('firm_careers_snapshots')
    .select('signals_hash,external_hosts,ats_signals,snapshot_at')
    .eq('firm_id', firmId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as PrevSnapshot | null;
}

async function persistAndDiff(
  supabase: SupabaseClient,
  result: ScanResult,
): Promise<'first_snapshot' | 'no_drift' | 'drift_raised' | 'drift_already_open' | 'failed_persist'> {
  if (!result.ok) return 'failed_persist';

  const prev = await lastSnapshot(supabase, result.firm.id);

  const { error: insertErr } = await supabase.from('firm_careers_snapshots').insert({
    firm_id: result.firm.id,
    firm_slug: result.firm.slug,
    url: result.fetched_url,
    status_code: result.status_code,
    content_hash: result.content_hash,
    external_hosts: result.external_hosts,
    ats_signals: result.ats_signals,
    signals_hash: result.signals_hash,
  });
  if (insertErr) {
    log({ level: 'warn', event: 'snapshot_insert_failed', firm: result.firm.slug, error: insertErr.message });
    return 'failed_persist';
  }

  if (!prev) return 'first_snapshot';
  if (prev.signals_hash === result.signals_hash) return 'no_drift';

  const prevSignals = new Set(prev.ats_signals ?? []);
  const currSignals = new Set(result.ats_signals);
  const added = result.ats_signals.filter((v) => !prevSignals.has(v));
  const removed = (prev.ats_signals ?? []).filter((v) => !currSignals.has(v));

  // Only raise an alert when the ATS vendor signals changed. Pure host-list
  // changes (e.g. a CDN was added) are recorded in the snapshot but don't
  // wake the operator.
  if (added.length === 0 && removed.length === 0) return 'no_drift';

  const { error: alertErr } = await supabase.from('system_alerts').insert({
    level: 'warn',
    kind: 'firm_careers_drift',
    firm_id: result.firm.id,
    message: `${result.firm.slug} careers page ATS signals changed (${[
      added.length > 0 ? `+${added.join(',')}` : null,
      removed.length > 0 ? `-${removed.join(',')}` : null,
    ].filter(Boolean).join(' ')}) — re-research before adapter breaks`,
    detail: {
      url: result.fetched_url,
      previous_signals: prev.ats_signals ?? [],
      current_signals: result.ats_signals,
      added,
      removed,
      external_hosts_current: result.external_hosts,
      previous_snapshot_at: prev.snapshot_at,
    },
  });
  if (alertErr) {
    if (/duplicate key|unique constraint/i.test(alertErr.message)) return 'drift_already_open';
    log({ level: 'warn', event: 'drift_alert_insert_failed', firm: result.firm.slug, error: alertErr.message });
    return 'failed_persist';
  }
  return 'drift_raised';
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

    // Both active and inactive firms get scanned — recovery via the host-
    // probe relies on the page being reachable, but real migrations are
    // about the page's *content* and only the careers-scan catches that.
    const { data: firms, error } = await supabase
      .from('firms')
      .select('id,slug,name,careers_url')
      .not('careers_url', 'is', null);
    if (error) throw new Error(`load firms: ${error.message}`);

    const list = (firms ?? []) as FirmRow[];
    log({ event: 'scan_start', firms: list.length });

    // 4 in parallel — each scan reads up to 512 KB of HTML, so we're
    // bandwidth-conscious. The full fleet (~60 firms) finishes well under
    // a minute.
    const results: ScanResult[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const batch = list.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(scanFirm));
      results.push(...batchResults);
    }

    const counters = {
      first_snapshot: 0,
      no_drift: 0,
      drift_raised: 0,
      drift_already_open: 0,
      failed_persist: 0,
      unreachable: 0,
    };

    for (const r of results) {
      if (!r.ok) {
        counters.unreachable += 1;
        continue;
      }
      const outcome = await persistAndDiff(supabase, r);
      counters[outcome] += 1;
    }

    const summary = {
      ok: true,
      ms: Math.round(performance.now() - startedAt),
      scanned: list.length,
      ...counters,
    };
    log({ event: 'scan_complete', ...summary });
    return Response.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', event: 'scan_failed', error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
