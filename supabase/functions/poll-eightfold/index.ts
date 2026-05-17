// Eightfold poller. Hits the SmartApply public JSON API:
//   GET https://{host}/api/apply/v2/jobs?domain={domain}&start={n}&num={pageSize}&Country=United+Kingdom&hl=en
//
// Config shape per firm (firms.ats_config): { host: string, domain: string, pageSize?: number, note?: string }.
//
// The API is unauth and identical across tenants (Citi, ServiceNow, Airbnb
// DirectSourcePro, Magnit, etc.). One adapter, many firms — only the host +
// domain changes per tenant.
//
// We pass `Country=United Kingdom` as a server-side filter so each request
// already returns UK-only results, but we still run the full `isUkLocation()`
// pass downstream because `positions[].locations` can be an array of multiple
// regions and we want to reject roles where London is one of several markets.

import { parseEightfoldConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

const DEFAULT_PAGE_SIZE = 25;
// 25 pages * 25 rows = 625 UK roles per firm. Citi's UK headcount is large but
// not that large; if we ever hit this cap, the warn log fires and we know to
// raise it. SmartRecruiters has the same MAX_PAGES discipline.
const MAX_PAGES = 25;

interface EightfoldPosition {
  // Eightfold-internal id (always present).
  id?: string | number;
  // ATS-side requisition id (preferred when present — stable across re-indexing).
  ats_job_id?: string | number;
  name?: string;
  // Some tenants return `location` as a single string; some return `locations`
  // as an array; some return both. We coalesce.
  location?: string;
  locations?: string[];
  business_unit?: string;
  department?: string;
  canonicalPositionUrl?: string;
  // Unix seconds.
  t_create?: number;
  t_update?: number;
}

interface EightfoldResponse {
  positions?: EightfoldPosition[];
  totalJobs?: number;
  count?: number;
}

async function fetchPage(
  host: string,
  domain: string,
  start: number,
  num: number,
  signal: AbortSignal | undefined,
): Promise<EightfoldResponse> {
  const qs = new URLSearchParams({
    domain,
    start: String(start),
    num: String(num),
    // Server-side UK filter. The exact param name (`Country`, capital C) is
    // documented in Eightfold's public API reference; many tenants also accept
    // `country`. We pass the capitalised form to match the docs.
    Country: 'United Kingdom',
    hl: 'en',
  });
  const url = `https://${host}/api/apply/v2/jobs?${qs.toString()}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      // Some Eightfold tenants (notably Citi) gate /api/apply/v2/jobs behind
      // a "PCSX" auth check that rejects requests without a matching Origin
      // header. Setting Origin + Referer to the tenant host bypasses the
      // 403 "Not authorized for PCSX" response — the API still requires no
      // cookies or tokens beyond that.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
      Origin: `https://${host}`,
      Referer: `https://${host}/careers`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Eightfold ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as EightfoldResponse;
}

function coalesceLocation(p: EightfoldPosition): string | null {
  // Prefer `location` (single string) for display. Fall back to first element
  // of `locations[]`. If the role is multi-region (`locations.length > 1`), we
  // still want to show one — the array is preserved in `raw` for debugging.
  if (typeof p.location === 'string' && p.location.length > 0) return p.location;
  if (Array.isArray(p.locations) && p.locations.length > 0 && typeof p.locations[0] === 'string') {
    return p.locations[0];
  }
  return null;
}

function joinSearchText(p: EightfoldPosition): string {
  // Concatenate every locational signal so isUkLocation() catches multi-region
  // postings where only `locations[2]` is London. Department is included as a
  // weak signal because some tenants pack region info into department names.
  const parts: string[] = [];
  if (typeof p.location === 'string') parts.push(p.location);
  if (Array.isArray(p.locations)) {
    for (const l of p.locations) {
      if (typeof l === 'string') parts.push(l);
    }
  }
  if (typeof p.department === 'string') parts.push(p.department);
  return parts.join(' ');
}

function toNormalized(p: EightfoldPosition): NormalizedPosting | null {
  // Prefer the ATS-side id so reindexing doesn't churn external_id; fall back
  // to the Eightfold id. Both are stringified — Eightfold returns them as
  // numbers on some tenants and strings on others, and we want a single
  // canonical shape downstream.
  const id = p.ats_job_id ?? p.id;
  if (id === undefined || id === null || p.name === undefined) return null;
  const externalId = String(id);
  if (externalId.length === 0) return null;
  if (!p.canonicalPositionUrl) return null;

  const location = coalesceLocation(p);
  const postedAt = typeof p.t_create === 'number' && Number.isFinite(p.t_create)
    ? new Date(p.t_create * 1000).toISOString()
    : null;

  return {
    externalId,
    title: p.name,
    location,
    applyUrl: p.canonicalPositionUrl,
    postedAt,
    searchText: joinSearchText(p),
    raw: p,
  };
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseEightfoldConfig(firm.ats_config, firm.slug);
  const pageSize = cfg.pageSize ?? DEFAULT_PAGE_SIZE;

  // First page to learn `totalJobs`.
  const first = await fetchPage(cfg.host, cfg.domain, 0, pageSize, signal);
  const out: NormalizedPosting[] = [];
  for (const p of first.positions ?? []) {
    const n = toNormalized(p);
    if (n) out.push(n);
  }

  const total = first.totalJobs ?? (first.positions ?? []).length;
  const naturalPages = Math.ceil(total / pageSize);
  const totalPages = Math.min(MAX_PAGES, naturalPages);

  if (naturalPages > MAX_PAGES) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      source: 'poll-eightfold',
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

  // Sequential pagination. Eightfold is lenient on rate but each tenant only
  // hosts a few hundred UK roles after the server-side Country filter, so the
  // wall clock stays well inside the per-firm 15s timeout.
  for (let page = 1; page < totalPages; page++) {
    const start = page * pageSize;
    const r = await fetchPage(cfg.host, cfg.domain, start, pageSize, signal);
    for (const p of r.positions ?? []) {
      const n = toNormalized(p);
      if (n) out.push(n);
    }
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-eightfold',
      atsType: 'eightfold',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
