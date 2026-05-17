// Lever poller. Hits the public postings API:
//   GET https://api.lever.co/v0/postings/{companySlug}?mode=json
// Some tenants (e.g. SEB) live only on the EU host api.eu.lever.co; the
// firm config selects between them via region: 'global' | 'eu'.
//
// Config shape per firm (firms.ats_config):
//   { companySlug: string, region?: 'global'|'eu', note?: string }.

import { parseLeverConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: {
    location?: string;
    commitment?: string;
    department?: string;
    team?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
}

async function fetchLever(
  host: string,
  companySlug: string,
  signal: AbortSignal | undefined,
): Promise<{ url: string; res: Response }> {
  const url = `https://${host}/v0/postings/${companySlug}?mode=json`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  return { url, res };
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseLeverConfig(firm.ats_config, firm.slug);
  // If region is unset and the global host 404s, fall back to the EU host
  // before declaring the firm broken. A clean 404 used to cascade into the
  // close-stale RPC and wipe the firm's open jobs in one tick; the runner now
  // has a sanity guard for that, but a transparent EU fallback also avoids
  // false-alarm "config missing" noise for any EU-only tenant whose config
  // forgot to set region: 'eu'.
  const primaryHost = cfg.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
  let { url, res } = await fetchLever(primaryHost, cfg.companySlug, signal);
  if (res.status === 404 && cfg.region === undefined) {
    // Free the unread 404 response body before re-issuing on the EU host.
    res.body?.cancel().catch(() => {});
    ({ url, res } = await fetchLever('api.eu.lever.co', cfg.companySlug, signal));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lever ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    // Lever returns { ok:false, error:"Document not found" } as an object for
    // unknown slugs even at 200. Treat that as a config error.
    const errBody = JSON.stringify(data).slice(0, 200);
    throw new Error(`Lever non-array response from ${url} :: ${errBody}`);
  }
  const out: NormalizedPosting[] = [];
  for (const j of data as LeverPosting[]) {
    if (!j.id || !j.text || !(j.hostedUrl || j.applyUrl)) continue;
    const cats = j.categories ?? {};
    const allLocs = (cats.allLocations ?? []).join(', ');
    const primaryLoc = cats.location ?? null;
    const location = primaryLoc ?? (allLocs || null);
    out.push({
      externalId: j.id,
      title: j.text,
      location,
      applyUrl: j.hostedUrl ?? j.applyUrl ?? '',
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      // Locational fields only. Team/department names like "UK Strategy" used
      // to leak in here and false-positive Dublin-based UK-coverage teams as
      // UK roles. Stick to the fields Lever actually intends as location.
      searchText: [primaryLoc, allLocs].filter(Boolean).join(' '),
      raw: j,
    });
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-lever',
      atsType: 'lever',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
