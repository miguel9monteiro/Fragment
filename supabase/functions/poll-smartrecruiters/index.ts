// SmartRecruiters poller. Hits the public Posting API:
//   GET https://api.smartrecruiters.com/v1/companies/{companySlug}/postings
// Returns up to PAGE_SIZE postings per page; we paginate until we exhaust
// `totalFound` or hit MAX_PAGES as a safety cap.
//
// Config shape per firm (firms.ats_config): { companySlug: string, note?: string }.
//
// The API is unauth and documented:
//   https://developers.smartrecruiters.com/docs/posting-api
// `companySlug` is the case-sensitive company identifier visible on a tenant's
// jobs page URL, e.g. "TPICAP" for TP ICAP.

import { parseSmartRecruitersConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

const PAGE_SIZE = 100; // SmartRecruiters caps the public Posting API at 100/page.
const MAX_PAGES = 10;  // 1,000 postings per firm. Realistic for any single SR tenant we care about.

interface SrLocation {
  city?: string;
  region?: string;
  country?: string;
  fullLocation?: string;
  remote?: boolean;
  hybrid?: boolean;
}

interface SrPosting {
  id?: string;
  name?: string;
  refNumber?: string;
  releasedDate?: string;
  ref?: string;
  location?: SrLocation;
  company?: { identifier?: string; name?: string };
}

interface SrResponse {
  offset?: number;
  limit?: number;
  totalFound?: number;
  content?: SrPosting[];
}

async function fetchPage(
  companySlug: string,
  offset: number,
  signal: AbortSignal | undefined,
): Promise<SrResponse> {
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companySlug)}/postings?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SmartRecruiters ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as SrResponse;
}

function toNormalized(companySlug: string, p: SrPosting): NormalizedPosting | null {
  if (!p.id || !p.name) return null;
  const loc = p.location ?? {};
  // SmartRecruiters' location.fullLocation is the rendered string
  // ("London, England, United Kingdom"). Both display + UK filter use this.
  // Fall back to the city when fullLocation is missing.
  const locationText = loc.fullLocation ?? loc.city ?? null;
  // Public apply URL is the standard SmartRecruiters job board pattern.
  // The API's `ref` field points at the API resource, not the apply page.
  const applyUrl = `https://jobs.smartrecruiters.com/${companySlug}/${p.id}`;
  return {
    externalId: p.id,
    title: p.name,
    location: locationText,
    applyUrl,
    postedAt: p.releasedDate ?? null,
    // searchText only sees the structured location, not the title or body --
    // matches the discipline followed by the other ATS adapters.
    searchText: locationText ?? '',
    raw: p,
  };
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseSmartRecruitersConfig(firm.ats_config, firm.slug);

  // Page 1 tells us the total.
  const first = await fetchPage(cfg.companySlug, 0, signal);
  const out: NormalizedPosting[] = [];
  for (const p of first.content ?? []) {
    const n = toNormalized(cfg.companySlug, p);
    if (n) out.push(n);
  }

  const total = first.totalFound ?? (first.content ?? []).length;
  const naturalPages = Math.ceil(total / PAGE_SIZE);
  const totalPages = Math.min(MAX_PAGES, naturalPages);

  if (naturalPages > MAX_PAGES) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      source: 'poll-smartrecruiters',
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

  // Pages 2..N sequentially. SmartRecruiters is small per-firm in practice
  // (TPICAP=4, most others <300) so sequential pagination is fine and keeps
  // the in-flight count to one per firm.
  for (let page = 1; page < totalPages; page++) {
    const offset = page * PAGE_SIZE;
    const r = await fetchPage(cfg.companySlug, offset, signal);
    for (const p of r.content ?? []) {
      const n = toNormalized(cfg.companySlug, p);
      if (n) out.push(n);
    }
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-smartrecruiters',
      atsType: 'smartrecruiters',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
