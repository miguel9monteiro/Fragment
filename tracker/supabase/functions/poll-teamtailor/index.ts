// TeamTailor poller. Hits the public RSS 2.0 feed:
//   GET https://{slug}.teamtailor.com/jobs.rss
// The .json equivalent is empty for most tenants; RSS is the source of truth.
// Each <item> carries title, description, pubDate, link, guid, and the
// namespaced <tt:locations>, <tt:department>, <tt:role> tags.
//
// Config shape per firm (firms.ats_config): { slug: string, note?: string }.
//
// TeamTailor tenants put location data in inconsistent places: sometimes in
// the title, sometimes only in the URL slug, often only in the (HTML)
// description. We rely on the structured <tt:locations> block for the UK
// filter -- the title and URL slug used to leak role/marketing copy that
// false-positived non-UK roles. The description body is not scanned at all.

import { parseTeamTailorConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

interface ParsedRssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string | null;
  // Clean display string ("Glasgow", "London", or "London, United Kingdom") --
  // extracted from the structured <tt:name>/<tt:city>/<tt:country> children
  // of <tt:locations>, NOT the raw XML block, which would otherwise leak into
  // the UI as literal markup.
  locationDisplay: string | null;
  // Whitespace-stripped text content of <tt:locations> (tags removed), used
  // only as a hint for the UK location filter.
  locationSearchHint: string;
  ttDepartment: string | null;
  ttRole: string | null;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// CDATA-aware text extraction. TeamTailor wraps <title>, <link>, and <guid>
// children in <![CDATA[...]]>. The previous parser captured the wrapper
// verbatim, so titles ended up stored as `<![CDATA[Investment Analyst]]>`
// and the literal markup leaked into the UI (regression of the XML-leakage
// class we have a memory about). Strip the wrapper unconditionally.
function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

function firstMatch(re: RegExp, hay: string): string | null {
  const m = hay.match(re);
  return m ? stripCdata(m[1]) : null;
}

function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTtLocation(itemBlock: string): { display: string | null; hint: string } {
  const raw = firstMatch(/<tt:locations>([\s\S]*?)<\/tt:locations>/i, itemBlock) ?? '';
  if (!raw.trim()) return { display: null, hint: '' };
  // Prefer <tt:name> for the display label. Fall back to "<city>, <country>".
  const name = firstMatch(/<tt:name>([\s\S]*?)<\/tt:name>/i, raw);
  const city = firstMatch(/<tt:city>([\s\S]*?)<\/tt:city>/i, raw);
  const country = firstMatch(/<tt:country>([\s\S]*?)<\/tt:country>/i, raw);
  const display = name?.trim() ||
    [city?.trim(), country?.trim()].filter(Boolean).join(', ') ||
    null;
  return { display, hint: stripXmlTags(raw) };
}

function parseRssItem(block: string): ParsedRssItem | null {
  const title = firstMatch(/<title>([\s\S]*?)<\/title>/i, block);
  const link = firstMatch(/<link>([\s\S]*?)<\/link>/i, block);
  const guid = firstMatch(/<guid[^>]*>([\s\S]*?)<\/guid>/i, block);
  if (!title || !link || !guid) return null;
  const { display, hint } = extractTtLocation(block);
  return {
    title: decodeHtmlEntities(title),
    // Decode `&amp;` -> `&` etc in the link too; some tenants emit URLs with
    // entity-escaped query strings that downstream middleware refuses.
    link: decodeHtmlEntities(link),
    guid: guid,
    pubDate: firstMatch(/<pubDate>([\s\S]*?)<\/pubDate>/i, block),
    locationDisplay: display,
    locationSearchHint: hint,
    ttDepartment: firstMatch(/<tt:department>([\s\S]*?)<\/tt:department>/i, block),
    ttRole: firstMatch(/<tt:role>([\s\S]*?)<\/tt:role>/i, block),
  };
}

function parseRssItems(xml: string): ParsedRssItem[] {
  const out: ParsedRssItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const parsed = parseRssItem(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
}

function rfc2822ToIso(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseTeamTailorConfig(firm.ats_config, firm.slug);
  const url = `https://${cfg.slug}.teamtailor.com/jobs.rss`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'FragmentTracker/0.1 (+https://fragmenttracker.app)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TeamTailor ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const xml = await res.text();
  const items = parseRssItems(xml);

  const out: NormalizedPosting[] = [];
  for (const it of items) {
    out.push({
      externalId: it.guid,
      title: it.title,
      location: it.locationDisplay,
      applyUrl: it.link,
      postedAt: rfc2822ToIso(it.pubDate),
      // Locational hints only. Previously the title and the URL slug were
      // included; both leaked role descriptions and tenant marketing copy
      // (e.g. "UK Markets" slugs) into the haystack and false-positived on
      // non-UK roles. Stick to the structured tt:locations text, which every
      // TeamTailor tenant populates.
      searchText: it.locationSearchHint,
      raw: it,
    });
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-teamtailor',
      atsType: 'teamtailor',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
