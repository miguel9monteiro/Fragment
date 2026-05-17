// Oleeo poller. Oleeo (formerly WCN) hosts tenant careers sites on *.tal.net
// and exposes a public feed per "vacancy board" on each tenant:
//   GET https://{host}/vx/lang-en-GB/mobile-0/appcentre-{appcentreId}/brand-{brandId}/candidate/jobboard/vacancy/{boardId}/feed
//
// Config shape per firm (firms.ats_config):
//   { host: string, appcentreId: string, brandId: string, boardIds: number[], note?: string }
//
// The endpoint serves Atom 1.0 (`<feed><entry>...</entry></feed>`) on tenants
// like Lazard, Evercore, Jefferies, Perella Weinberg — NOT the RSS 2.0 shape
// that earlier research suggested. Some tenants additionally return HTML for
// invalid board IDs, so the parser is tolerant: it accepts both Atom and
// RSS, and returns 0 entries silently when the response is HTML (logged via
// the runner's `fetched=0` result).
//
// Most tenants run two or three boards under the same appcentre+brand pair
// (e.g. one for experienced hires, one for campus/students, sometimes one for
// events). We merge across boards and dedupe on the `/opp/{id}` segment, which
// is the stable Oleeo requisition id.

import { parseOleeoConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

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

function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

function firstMatch(re: RegExp, hay: string): string | null {
  const m = hay.match(re);
  return m ? stripCdata(m[1]) : null;
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Oleeo job-detail URLs end in `/opp/{numericId}-{slug}` (or sometimes the
// trailing slug is missing). The numeric prefix is the stable requisition id,
// reused across re-pubs of the same role.
function extractOppId(link: string): string | null {
  const m = link.match(/\/opp\/(\d+)(?:[-/]|$)/i);
  return m ? m[1] : null;
}

interface ParsedItem {
  title: string;
  link: string;
  // ISO 8601 if extracted (Atom <published>/<updated>) or null. RSS pubDate
  // arrives as RFC2822 — normalised by the caller via rfc2822ToIso. For Atom
  // we hand the value straight through since it's already ISO.
  pubDate: string | null;
  // Plain-text body extracted from the feed entry's description / content
  // element. Used as a UK-filter haystack since Oleeo doesn't surface a
  // structured location tag.
  body: string;
}

// Atom entries use <link rel="alternate" href="..."/> and <title>...</title>
// without CDATA wrappers. The href we want is the FIRST link with rel="alternate"
// (Atom may include multiple links per entry, e.g. self + alternate).
function extractAtomHref(block: string): string | null {
  // Walk through every <link> tag in the entry. Prefer rel="alternate" with a
  // href that contains "/opp/" (the canonical job-detail URL on Oleeo); fall
  // back to any href if that pattern misses.
  const linkTags = block.match(/<link\b[^>]*>/gi) ?? [];
  let fallback: string | null = null;
  for (const tag of linkTags) {
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (!fallback) fallback = href;
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? 'alternate';
    if (rel === 'alternate' && /\/opp\//.test(href)) return href;
  }
  return fallback;
}

function parseAtomEntries(xml: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const titleRaw = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, block);
    const href = extractAtomHref(block);
    if (!titleRaw || !href) continue;
    // Prefer <published>; fall back to <updated>. Both ship as ISO 8601 on
    // Oleeo feeds, so we hand them through unchanged.
    const isoPublished = firstMatch(/<published[^>]*>([\s\S]*?)<\/published>/i, block)
      ?? firstMatch(/<updated[^>]*>([\s\S]*?)<\/updated>/i, block);
    const contentRaw = firstMatch(/<content[^>]*>([\s\S]*?)<\/content>/i, block) ?? '';
    const body = stripHtmlTags(decodeHtmlEntities(contentRaw));
    out.push({
      title: decodeHtmlEntities(titleRaw).trim(),
      link: decodeHtmlEntities(href),
      pubDate: isoPublished,
      body,
    });
  }
  return out;
}

function parseRssItems(xml: string): ParsedItem[] {
  const out: ParsedItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const titleRaw = firstMatch(/<title>([\s\S]*?)<\/title>/i, block);
    const linkRaw = firstMatch(/<link>([\s\S]*?)<\/link>/i, block);
    if (!titleRaw || !linkRaw) continue;
    const descRaw = firstMatch(/<description>([\s\S]*?)<\/description>/i, block) ?? '';
    const body = stripHtmlTags(decodeHtmlEntities(descRaw));
    // pubDate in RSS is RFC2822; normalise to ISO downstream.
    const pubRaw = firstMatch(/<pubDate>([\s\S]*?)<\/pubDate>/i, block);
    out.push({
      title: decodeHtmlEntities(titleRaw),
      link: decodeHtmlEntities(linkRaw),
      pubDate: rfc2822ToIso(pubRaw),
      body,
    });
  }
  return out;
}

// Auto-detect Atom vs RSS. HTML responses (when a tenant returns the candidate
// portal HTML for an invalid boardId) match neither and return [].
function parseItems(xml: string): ParsedItem[] {
  if (/<feed\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(xml)) {
    return parseAtomEntries(xml);
  }
  if (/<rss\b/i.test(xml)) {
    return parseRssItems(xml);
  }
  return [];
}

function rfc2822ToIso(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Best-effort location extraction from the description body. Oleeo doesn't
// emit a structured location field in its RSS, so we look for the first
// "Location:" or "Where:" label, then fall back to the title (Oleeo titles
// often embed location, e.g. "Analyst, London"). The string returned here is
// for display only; the UK filter scans `searchText` which already includes
// both the title and the body.
function extractLocationDisplay(title: string, body: string): string | null {
  const labelled = body.match(/Location\s*:\s*([^|·•\n]{2,60})/i)
    ?? body.match(/Where\s*:\s*([^|·•\n]{2,60})/i);
  if (labelled) return labelled[1].trim();
  // Title-based fallback: comma followed by a likely city name.
  const titleHint = title.match(/,\s*([A-Z][\w\s\-&]{2,40})$/);
  if (titleHint) return titleHint[1].trim();
  return null;
}

async function fetchBoard(
  host: string,
  appcentreId: string,
  brandId: string,
  boardId: number,
  signal: AbortSignal | undefined,
): Promise<NormalizedPosting[]> {
  const url = `https://${host}/vx/lang-en-GB/mobile-0/appcentre-${appcentreId}/brand-${brandId}/candidate/jobboard/vacancy/${boardId}/feed`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  // 404 means this boardId doesn't exist on this tenant — different Oleeo
  // tenants enumerate boards differently, so we configure a wide net per firm
  // and tolerate missing entries instead of aborting the whole firm. All
  // other non-OK statuses (403, 5xx) propagate so the firm result records an
  // actual error.
  if (res.status === 404) {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      source: 'poll-oleeo',
      level: 'info',
      event: 'board_missing',
      host,
      boardId,
    }));
    return [];
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Oleeo ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  const xml = await res.text();
  const items = parseItems(xml);

  const out: NormalizedPosting[] = [];
  for (const it of items) {
    const externalId = extractOppId(it.link);
    if (!externalId) continue;
    const location = extractLocationDisplay(it.title, it.body);
    out.push({
      externalId,
      title: it.title,
      location,
      applyUrl: it.link,
      // Already normalised to ISO (or null) inside parseItems.
      postedAt: it.pubDate,
      // Include title + body so the UK filter has a chance to spot London /
      // United Kingdom mentions even when there's no structured location.
      // Oleeo titles often embed the city, so the title alone is usually
      // enough; the body is a safety net for tenants that omit it.
      searchText: `${it.title} ${it.body}`,
      raw: it,
    });
  }
  return out;
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseOleeoConfig(firm.ats_config, firm.slug);

  // Fan out across boards. Most tenants have 1–3 boards; we fetch them in
  // parallel since they're independent feeds on the same host.
  const perBoard = await Promise.all(
    cfg.boardIds.map((boardId) =>
      fetchBoard(cfg.host, cfg.appcentreId, cfg.brandId, boardId, signal),
    ),
  );

  // Dedupe on externalId. Some Oleeo tenants list the same opp across
  // multiple boards (e.g. a campus role mirrored on the experienced board);
  // we keep the first occurrence so the firm row's "preferred" board wins.
  const seen = new Set<string>();
  const out: NormalizedPosting[] = [];
  for (const postings of perBoard) {
    for (const p of postings) {
      if (seen.has(p.externalId)) continue;
      seen.add(p.externalId);
      out.push(p);
    }
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-oleeo',
      atsType: 'oleeo',
      fetcher,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
