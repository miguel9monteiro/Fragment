// Oracle HCM Cloud Recruiting (Candidate Experience) poller. Reads every active
// firm with ats='oracle_hcm', hits the public REST endpoint, paginates, and
// hands off to the shared runner for UK filtering, classification, and upsert.
//
// Endpoint:
//   GET https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
//       ?finder=findReqs[;selectedLocationsFacet={id}]&limit=25&offset={M}
//       &onlyData=true&expand=requisitionList
//
// Response shape: items[0].requisitionList is the array of postings;
// items[0].TotalJobsCount is the total count for the current filter context.
//
// Config shape per firm (firms.ats_config):
//   {
//     host: string,                       // tenant host
//     siteNumber: string,                 // CX site id (e.g. "CX_1001")
//     selectedLocationsFacets?: string[], // optional UK GeographyId pre-filter
//     note?: string
//   }
//
// Server-side cap. Oracle HCM caps the requisitionList child collection at
// 25 rows per page regardless of `limit`. Confirmed empirically: limit=50,
// 100, 200, 500 all return exactly 25 reqs. PAGE_SIZE is therefore pinned
// to the real cap rather than the requested limit.
//
// Why selectedLocationsFacets is preferred. A full global scan for JPM is
// 7414/25 = ~297 pages; even at concurrency 8 the wall clock approaches the
// 30s pg_net budget. Passing a UK GeographyId (e.g. London = 300000057005324)
// narrows the response to ~495 reqs / ~20 pages and finishes in seconds. The
// adapter fans out one paginated scan per facet and dedupes by requisition Id.
// When the config omits selectedLocationsFacets we paginate globally — viable
// only for small tenants.

import { parseOracleHcmConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

const PAGE_SIZE = 25;        // Server-enforced cap; raising the request param is a no-op.
const MAX_PAGES = 80;        // = 2000 reqs per facet. JPM London tops out near 500; ample headroom.
const PARALLEL_CONCURRENCY = 6;
const PER_FIRM_TIMEOUT_MS = 25_000;

interface OracleHcmRequisition {
  Id?: string;
  Title?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  PostedDate?: string;
  ShortDescriptionStr?: string;
}

// The Oracle endpoint always wraps results in a single-item array whose
// element carries the search metadata, facets and the requisitionList child.
// `TotalJobsCount` lives on the wrapper, not on each req.
interface OracleHcmSearchItem {
  TotalJobsCount?: number;
  requisitionList?: OracleHcmRequisition[];
}

interface OracleHcmResponse {
  items?: OracleHcmSearchItem[];
}

function buildUrl(host: string, offset: number, locationFacet: string | undefined): string {
  const finderParts = ['findReqs'];
  if (locationFacet) finderParts.push(`selectedLocationsFacet=${encodeURIComponent(locationFacet)}`);
  const finder = finderParts.join(';');
  return `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=${finder}&limit=${PAGE_SIZE}&offset=${offset}&onlyData=true&expand=requisitionList`;
}

async function fetchPage(
  host: string,
  offset: number,
  locationFacet: string | undefined,
  signal: AbortSignal | undefined,
): Promise<OracleHcmSearchItem> {
  const url = buildUrl(host, offset, locationFacet);
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OracleHCM ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as OracleHcmResponse;
  const item = data.items?.[0];
  if (!item) {
    throw new Error(`OracleHCM empty items[] from ${url}`);
  }
  return item;
}

function postedDateToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  // Oracle returns YYYY-MM-DD; coerce to a UTC midnight ISO timestamp so the
  // jobs.posted_at column gets a stable, timezone-explicit value.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
}

function toNormalized(
  host: string,
  siteNumber: string,
  r: OracleHcmRequisition,
): NormalizedPosting | null {
  if (!r.Id || !r.Title) return null;
  const applyUrl = `https://${host}/hcmUI/CandidateExperience/en/sites/${siteNumber}/job/${r.Id}`;
  // searchText concatenates location + country code so the UK filter can
  // match on either "London, United Kingdom" or the bare "GB" country code.
  // Both are present and structured in every Oracle posting we observed.
  const searchText = [r.PrimaryLocation ?? '', r.PrimaryLocationCountry ?? '']
    .filter(Boolean)
    .join(' ');
  return {
    externalId: r.Id,
    title: r.Title,
    location: r.PrimaryLocation ?? null,
    applyUrl,
    postedAt: postedDateToIso(r.PostedDate),
    searchText,
    raw: r,
  };
}

async function scanFacet(
  source: string,
  firmSlug: string,
  host: string,
  siteNumber: string,
  locationFacet: string | undefined,
  signal: AbortSignal | undefined,
): Promise<NormalizedPosting[]> {
  const first = await fetchPage(host, 0, locationFacet, signal);
  const out: NormalizedPosting[] = [];
  for (const r of first.requisitionList ?? []) {
    const n = toNormalized(host, siteNumber, r);
    if (n) out.push(n);
  }

  const total = first.TotalJobsCount ?? (first.requisitionList ?? []).length;
  const naturalPages = Math.ceil(total / PAGE_SIZE);
  const totalPages = Math.min(MAX_PAGES, naturalPages);

  if (naturalPages > MAX_PAGES) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      source,
      level: 'warn',
      event: 'pagination_truncated',
      firm: firmSlug,
      locationFacet: locationFacet ?? null,
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
      batch.map((o) => fetchPage(host, o, locationFacet, signal)),
    );
    for (const item of pages) {
      for (const r of item.requisitionList ?? []) {
        const n = toNormalized(host, siteNumber, r);
        if (n) out.push(n);
      }
    }
  }
  return out;
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseOracleHcmConfig(firm.ats_config, firm.slug);

  // When location facets are configured, fan out one scan per facet and dedupe
  // by Id. When absent, run a single unfiltered scan -- viable only for small
  // tenants because of the 25/page server cap.
  const facets: (string | undefined)[] = cfg.selectedLocationsFacets ?? [undefined];

  const results = await Promise.all(
    facets.map((f) => scanFacet('poll-oracle-hcm', firm.slug, cfg.host, cfg.siteNumber, f, signal)),
  );

  const byId = new Map<string, NormalizedPosting>();
  for (const list of results) {
    for (const p of list) {
      // First occurrence wins. Multiple facets returning the same req happens
      // when a posting straddles cities (rare but possible).
      if (!byId.has(p.externalId)) byId.set(p.externalId, p);
    }
  }
  return Array.from(byId.values());
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-oracle-hcm',
      atsType: 'oracle_hcm',
      fetcher,
      perFirmTimeoutMs: PER_FIRM_TIMEOUT_MS,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
