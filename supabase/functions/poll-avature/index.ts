// Avature poller. Avature is HTML-only — there is no public JSON API on
// tenant career sites — so this poller fetches the search HTML and extracts
// job cards via regex.
//
// Endpoint shape:
//   GET https://{host}{searchPath}?{recordsParam}={pageSize}&{offsetParam}={offset}
//
// Per-tenant param names vary: HSBC uses `pipelineRecordsPerPage` +
// `pipelineOffset`; Macquarie uses `jobRecordsPerPage` + `jobOffset`; Deloitte
// UK and William Blair are configurable too. All of those names live in
// firms.ats_config so the adapter stays generic.
//
// We deliberately do NOT pull in a heavy HTML parser (deno-dom/linkedom). The
// shape we need from each card is small: an anchor whose href contains the
// detail-path-token plus a numeric id, the anchor text (title), and the
// nearest location-ish sibling text. Regex over the response body is fragile
// in general but stable enough here because Avature renders consistently
// per-tenant and we can re-tune the regex if a tenant cosmetic-changes.

import { parseAvatureConfig } from '../_shared/ats-config.ts';
import { runPoller } from '../_shared/poll-runner.ts';
import type { Fetcher, NormalizedPosting } from '../_shared/types.ts';

const DEFAULT_PAGE_SIZE = 50;
// 30 pages * 50 rows = 1500 roles. HSBC's mycareer typically lists ~55
// global roles at a time, so we'll rarely hit this. The cap is a safety net
// against pagination going infinite if the "no more results" signal changes.
const DEFAULT_MAX_PAGES = 30;

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

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Escape regex metacharacters in user-controlled config strings.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface RawCard {
  externalId: string;
  detailHref: string;
  title: string;
  // Slice of HTML surrounding the anchor — used as the haystack for the UK
  // location filter. Tags are stripped before downstream comparison.
  context: string;
}

// Extract job cards from an Avature search HTML page. We look for anchors
// whose href includes the tenant-specific `detailPathToken` (e.g.
// "PipelineDetail" or "JobDetail") followed by a numeric id. The id can be
// the last path segment (HSBC: /PipelineDetail/slug/{id}) or a query string
// (Macquarie: /JobDetail?jobId={id}); the regex handles both.
function extractCards(html: string, detailPathToken: string): RawCard[] {
  const token = escapeRegex(detailPathToken);
  // Match <a ... href="...{token}...{id}...">{label}</a>, capturing href, id,
  // and label. The id pattern accepts /1234, ?jobId=1234, &id=1234, etc.
  const re = new RegExp(
    // 1: full href value
    `<a\\b[^>]*?\\bhref=["']([^"']*?${token}[^"']*?)["'][^>]*?>` +
    // 2: anchor inner HTML (may contain spans / line breaks)
    `([\\s\\S]*?)` +
    `</a>`,
    'gi',
  );
  const seen = new Set<string>();
  const out: RawCard[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2];
    // Extract the requisition id from the href. Try, in order:
    //   1. ?jobId=NNNN or &jobId=NNNN
    //   2. trailing /NNNN
    //   3. fallback: last digit-run in the href
    const idQuery = href.match(/[?&](?:jobId|requisitionId|reqId|id)=(\d+)/i);
    const idPath = href.match(/\/(\d+)(?:[/?#]|$)/);
    const idFallback = href.match(/(\d+)/g);
    const externalId = idQuery?.[1]
      ?? idPath?.[1]
      ?? (idFallback ? idFallback[idFallback.length - 1] : null);
    if (!externalId) continue;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const title = decodeHtmlEntities(stripHtmlTags(inner));
    if (!title) continue;

    // Pull ~600 chars of surrounding HTML for the location haystack. The
    // anchor is at the start of the slice; downstream code strips tags and
    // scans for UK keywords.
    const start = Math.max(0, m.index - 50);
    const end = Math.min(html.length, m.index + m[0].length + 600);
    const context = html.slice(start, end);

    out.push({
      externalId,
      detailHref: href,
      title,
      context,
    });
  }
  return out;
}

// Resolve a possibly-relative href to an absolute URL on `host`.
function absoluteUrl(host: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `https://${host}${href}`;
  return `https://${host}/${href}`;
}

// Best-effort location extraction from the post-anchor context. We look for a
// span/div whose text mentions a city or country token; otherwise we return
// the cleaned context as a single string, which the UK filter can still scan.
function pickLocationDisplay(context: string): string | null {
  // Common Avature shapes:
  //   <span class="job-location">London, United Kingdom</span>
  //   <li class="location">London</li>
  //   <div ...>Location: London</div>
  const labelled = context.match(/(?:class|id)=["'][^"']*(?:location|where)[^"']*["'][^>]*>([\s\S]{2,120}?)</i);
  if (labelled) {
    const t = stripHtmlTags(decodeHtmlEntities(labelled[1])).trim();
    if (t.length > 0) return t;
  }
  const labelText = context.match(/Location\s*:\s*<[^>]*>([\s\S]{2,80}?)</i);
  if (labelText) {
    const t = stripHtmlTags(decodeHtmlEntities(labelText[1])).trim();
    if (t.length > 0) return t;
  }
  return null;
}

async function fetchPage(
  url: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Avature ${res.status} from ${url} :: ${body.slice(0, 200)}`);
  }
  return await res.text();
}

const fetcher: Fetcher = async (firm, signal) => {
  const cfg = parseAvatureConfig(firm.ats_config, firm.slug);
  const pageSize = cfg.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = cfg.maxPages ?? DEFAULT_MAX_PAGES;

  const out: NormalizedPosting[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const qs = new URLSearchParams({
      [cfg.recordsParam]: String(pageSize),
      [cfg.offsetParam]: String(offset),
    });
    const url = `https://${cfg.host}${cfg.searchPath}?${qs.toString()}`;
    const html = await fetchPage(url, signal);
    const cards = extractCards(html, cfg.detailPathToken);

    // Empty page means we've passed the end of the result set. Avature
    // tenants tend to render a "no results" panel rather than a hard 404, so
    // exiting on zero cards is the reliable termination signal.
    if (cards.length === 0) break;

    let addedThisPage = 0;
    for (const c of cards) {
      if (seen.has(c.externalId)) continue;
      seen.add(c.externalId);
      const displayLocation = pickLocationDisplay(c.context);
      out.push({
        externalId: c.externalId,
        title: c.title,
        location: displayLocation,
        applyUrl: absoluteUrl(cfg.host, c.detailHref),
        // Avature does not expose posted-at in card HTML reliably.
        postedAt: null,
        // searchText concatenates the title and the cleaned context block so
        // isUkLocation() has every locational signal available, including
        // unlabelled location spans inside the card.
        searchText: `${c.title} ${stripHtmlTags(decodeHtmlEntities(c.context))}`,
        raw: { href: c.detailHref, title: c.title },
      });
      addedThisPage++;
    }

    // If the page returned cards but none were new, Avature is looping the
    // last page (some tenants do this when offset >= total). Stop instead of
    // burning the per-firm timeout.
    if (addedThisPage === 0) break;

    // If the page returned fewer cards than pageSize, we're on the last page.
    if (cards.length < pageSize) break;
  }
  return out;
};

Deno.serve(async (_req) => {
  try {
    const summary = await runPoller({
      source: 'poll-avature',
      atsType: 'avature',
      fetcher,
      // Avature HTML scrape is heavier than JSON polls (HTML response + regex
      // parse per page); bump the per-firm budget so William Blair / Deloitte
      // UK don't tip the runner over its default.
      perFirmTimeoutMs: 25_000,
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
