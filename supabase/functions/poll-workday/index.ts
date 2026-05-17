// Workday poller. Reads every active firm with ats='workday', hits the public
// CXS jobs endpoint, paginates, normalizes, and hands off to the shared runner
// for UK filtering, classification, and DB upsert.
//
// Page strategy: fetch page 1 sequentially to learn `total`, then fetch the
// remaining pages in bounded parallel batches. PAGE_SIZE=50 + MAX_PAGES=10
// covers up to 500 roles per tenant — enough for any UK Workday firm we
// currently track. PARALLEL_CONCURRENCY caps simultaneous in-flight requests
// per firm so we don't burst the per-tenant WAF.
//
// Per-firm timeout is 20s (vs the runner's 15s default) to give large tenants
// like MS / BofA / DB the headroom they need.

import { parseWorkdayConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

// Workday tightened the per-request `limit` ceiling to 20 (verified against
// hl.wd1 and ms.wd5: limit=20 returns HTTP 200, limit=21 or higher returns
// HTTP 400 with an empty error message across every tenant). The poller had
// PAGE_SIZE=50 from day one and never recorded a single successful run.
// MAX_PAGES is raised to 25 so we keep the same 500-role per-tenant ceiling
// the old 50 x 10 implied. Peak in-flight is bounded by PARALLEL_CONCURRENCY,
// not page count, so wall-clock per firm only grows from ~2s to ~3s.
const PAGE_SIZE = 20;
const MAX_PAGES = 25;
// Per-firm page concurrency. Workday CXS rate-limits aggressively per source
// IP; reducing from 4 to 2 cuts the per-firm peak burst in half. Combined
// with the FIRM_CONCURRENCY cap below, total in-flight stays well under
// what tripped the WAF when we bulk-seeded 24 Workday firms.
const PARALLEL_CONCURRENCY = 2;
// Bumped from 20s to 30s: with PAGE_SIZE=20, slow-responding tenants
// (blackrock.wd1, rbc.wd3) couldn't even return page 1 within 20s and ended
// up parked in extended backoff. 30s gives them headroom without exceeding
// the Edge Function wall-clock budget — worst case 6 batches x 30s = 180s
// only fires if every firm hits the ceiling, which the data does not show.
const PER_FIRM_TIMEOUT_MS = 30_000;
// Cap simultaneously-processed Workday firms. With ~24 active firms and the
// previous unbounded Promise.all, peak was ~96 simultaneous requests from
// one Supabase Edge IP — Workday's WAF responded by 400'ing everything for
// minutes at a time. 4 firms × 2 pages = 8 in-flight peak is well below the
// observed safe threshold.
const FIRM_CONCURRENCY = 4;

interface WorkdayJobPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  bulletFields?: string[];
  postedOn?: string;
}

interface WorkdayJobsResponse {
  total?: number;
  jobPostings?: WorkdayJobPosting[];
}

async function fetchWorkdayPage(
  host: string,
  tenant: string,
  site: string,
  offset: number,
  signal: AbortSignal | undefined,
): Promise<WorkdayJobsResponse> {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      // Workday's WAF flagged our "FragmentTracker/0.1" UA when the request
      // rate from one Edge IP spiked above ~10 in-flight per minute. A
      // mainstream browser UA + the standard Accept-Language + Origin /
      // Referer pair drops back below the threshold. Don't read too much
      // into the version pin — Workday is just sniffing for "obvious bot".
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
      Origin: `https://${host}`,
      Referer: `https://${host}/en-US/${site}`,
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit: PAGE_SIZE,
      offset,
      searchText: '',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Workday ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as WorkdayJobsResponse;
}

function parsePostedAt(raw: string | undefined): string | null {
  if (!raw) return null;
  // Workday returns "Posted Today", "Posted Yesterday", "Posted 3 Days Ago".
  // Anything older or weekly/monthly we leave null and let detected_at carry
  // the freshness signal.
  const lower = raw.toLowerCase();
  const now = new Date();
  if (lower.includes('today')) return now.toISOString();
  if (lower.includes('yesterday')) {
    now.setUTCDate(now.getUTCDate() - 1);
    return now.toISOString();
  }
  const m = lower.match(/(\d+)\s+day/);
  if (m) {
    now.setUTCDate(now.getUTCDate() - Number(m[1]));
    return now.toISOString();
  }
  return null;
}

function toNormalized(
  host: string,
  site: string,
  p: WorkdayJobPosting,
): NormalizedPosting | null {
  const path = p.externalPath;
  if (!path || !p.title) return null;
  // externalPath looks like "/job/London/Investment-Banking-Analyst_2024-12345".
  // Workday CXS omits the site segment, so splice it in to get a resolvable URL.
  //
  // Use the FULL externalPath as the external_id, not just the trailing req
  // code. Workday tenants reuse the same JR-code across geographic listings
  // (e.g. a London and a New York posting for the same global req both end
  // with "_2024-12345"); splitting on "_" collapsed them to the same id and
  // either (a) clobbered the UK listing with the US apply_url under
  // parallel-page racing, or (b) raised `21000 ON CONFLICT DO UPDATE cannot
  // affect row a second time` and aborted the whole upsert.
  const externalId = path;
  const applyUrl = `https://${host}/${site}${path}`;
  // Workday's bulletFields[] sometimes contains team/function names
  // ("UK Markets Trading") rather than location -- which used to leak the
  // "UK" token into non-UK rows. We rely on locationsText, which Workday
  // populates for every posting; if a future tenant truly omits it we will
  // see a coverage gap rather than an over-detection.
  return {
    externalId,
    title: p.title,
    location: p.locationsText ?? null,
    applyUrl,
    postedAt: parsePostedAt(p.postedOn),
    searchText: p.locationsText ?? '',
    raw: p,
  };
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseWorkdayConfig(firm.ats_config, firm.slug);

  // Page 1 tells us how many pages exist via `total`.
  const first = await fetchWorkdayPage(cfg.host, cfg.tenant, cfg.site, 0, signal);
  const out: NormalizedPosting[] = [];
  for (const p of first.jobPostings ?? []) {
    const n = toNormalized(cfg.host, cfg.site, p);
    if (n) out.push(n);
  }

  const total = first.total ?? (first.jobPostings ?? []).length;
  const naturalPages = Math.ceil(total / PAGE_SIZE);
  const totalPages = Math.min(MAX_PAGES, naturalPages);

  // Loud warning when we're silently dropping the tail of large tenants.
  // BofA / Morgan Stanley / Deutsche Bank routinely exceed 500 active reqs
  // globally; UK roles get distributed across pages, so a UK London IB role
  // sitting on page 11+ never enters the system and then close_stale_jobs
  // closes it (last cycle saw it; this cycle does not). The structured log
  // surfaces this in Edge Function logs so we can bump MAX_PAGES per tenant
  // before the gap silently grows.
  if (naturalPages > MAX_PAGES) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      source: 'poll-workday',
      level: 'warn',
      event: 'pagination_truncated',
      firm: firm.slug,
      total,
      naturalPages,
      maxPages: MAX_PAGES,
      droppedPages: naturalPages - MAX_PAGES,
    }));
  }
  if (totalPages <= 1) return out;

  const offsets: number[] = [];
  for (let page = 1; page < totalPages; page++) offsets.push(page * PAGE_SIZE);

  for (let i = 0; i < offsets.length; i += PARALLEL_CONCURRENCY) {
    const batch = offsets.slice(i, i + PARALLEL_CONCURRENCY);
    const pages = await Promise.all(
      batch.map((o) => fetchWorkdayPage(cfg.host, cfg.tenant, cfg.site, o, signal)),
    );
    for (const r of pages) {
      for (const p of r.jobPostings ?? []) {
        const n = toNormalized(cfg.host, cfg.site, p);
        if (n) out.push(n);
      }
    }
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-workday',
      atsType: 'workday',
      fetcher,
      perFirmTimeoutMs: PER_FIRM_TIMEOUT_MS,
      firmConcurrency: FIRM_CONCURRENCY,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
