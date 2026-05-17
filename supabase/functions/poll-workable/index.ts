// Workable poller. Hits the public widget account API:
//   GET https://apply.workable.com/api/v1/widget/accounts/{slug}
// Returns { name, description, jobs:[] } where each job has structured
// country/city/state plus a locations[] array with ISO country codes.
//
// Config shape per firm (firms.ats_config): { slug: string, note?: string }.
//
// Workable is heavily used by non-UK companies (Valsoft alone has 341 jobs
// across 20+ countries). The UK filter is what keeps non-UK roles out.

import { parseWorkableConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

interface WorkableLocation {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  hidden?: boolean;
}

interface WorkableJob {
  shortcode?: string;
  title?: string;
  country?: string;
  city?: string;
  state?: string;
  locations?: WorkableLocation[];
  application_url?: string;
  shortlink?: string;
  url?: string;
  published_on?: string;
  created_at?: string;
  department?: string;
  employment_type?: string;
}

interface WorkableResponse {
  name?: string;
  description?: string;
  jobs?: WorkableJob[];
}

function pickApplyUrl(j: WorkableJob): string | null {
  return j.shortlink ?? j.url ?? j.application_url ?? null;
}

function buildLocationLabel(j: WorkableJob): string | null {
  // Prefer the structured city/country tuple over the locations[] array.
  const parts = [j.city, j.state, j.country].filter((s): s is string => Boolean(s));
  if (parts.length > 0) return parts.join(', ');
  const first = (j.locations ?? []).find((l) => !l.hidden);
  if (first) {
    const ps = [first.city, first.region, first.country].filter((s): s is string => Boolean(s));
    return ps.join(', ') || null;
  }
  return null;
}

// Normalize Workable's date strings to ISO timestamps.
// `published_on` is a date-only string ("YYYY-MM-DD"); naively passing that
// through means every Workable job sorts to 00:00 UTC of its day, behind any
// same-day Greenhouse/Lever posting that carries a real timestamp. Prefer
// `created_at` when present (full ISO); else promote `published_on` to ISO.
function normalizePostedAt(j: WorkableJob): string | null {
  if (j.created_at) {
    const d = new Date(j.created_at);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (j.published_on) {
    const d = new Date(j.published_on);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseWorkableConfig(firm.ats_config, firm.slug);
  const url = `https://apply.workable.com/api/v1/widget/accounts/${cfg.slug}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Workable ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as WorkableResponse;
  const out: NormalizedPosting[] = [];
  for (const j of data.jobs ?? []) {
    if (!j.shortcode || !j.title) continue;
    const apply = pickApplyUrl(j);
    if (!apply) continue;
    const location = buildLocationLabel(j);
    const locTokens = (j.locations ?? [])
      .map((l) => [l.countryCode, l.country, l.city, l.region].filter(Boolean).join(' '))
      .join(' ');
    out.push({
      externalId: j.shortcode,
      title: j.title,
      location,
      applyUrl: apply,
      postedAt: normalizePostedAt(j),
      // Locational signals only -- the title is excluded because role names
      // like "UK Reporting Lead" used to false-positive in the filter.
      // Country codes like "GB" are matched by isUkLocation alongside the
      // long-form "United Kingdom".
      searchText: `${j.country ?? ''} ${j.city ?? ''} ${j.state ?? ''} ${locTokens}`.trim(),
      raw: j,
    });
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-workable',
      atsType: 'workable',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
