// Greenhouse poller. Hits the public boards API:
//   GET https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs
// Returns the full job list in a single response, no pagination required.
//
// Config shape per firm (firms.ats_config): { boardToken: string, note?: string }.

import { parseGreenhouseConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

interface GreenhouseJob {
  id: number;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  first_published?: string;
  updated_at?: string;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseGreenhouseConfig(firm.ats_config, firm.slug);
  const url = `https://boards-api.greenhouse.io/v1/boards/${cfg.boardToken}/jobs`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Greenhouse ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as GreenhouseResponse;
  const out: NormalizedPosting[] = [];
  for (const j of data.jobs ?? []) {
    if (!j.id || !j.title || !j.absolute_url) continue;
    const locName = j.location?.name ?? null;
    out.push({
      externalId: String(j.id),
      title: j.title,
      location: locName,
      applyUrl: j.absolute_url,
      postedAt: j.first_published ?? null,
      // Greenhouse's location.name is reliable and structured. Title used to
      // be appended as a safety net but it false-positived on role names
      // containing UK/Cambridge/etc. for non-UK postings; trust the location
      // field, which Greenhouse populates on every posting.
      searchText: locName ?? '',
      raw: j,
    });
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-greenhouse',
      atsType: 'greenhouse',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
