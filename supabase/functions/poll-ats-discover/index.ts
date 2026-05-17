// poll-ats-discover. Tier-6 expansion autonomy. Given a careers_url, probe
// the page (and, where useful, a small set of common ATS-specific endpoints)
// and produce a structured suggestion the operator can accept to seed a new
// firm row. Today adding a firm is a ~20-minute manual research task; this
// function reduces it to a one-click form when the firm is on any supported
// ATS.
//
// Input (POST body OR query string):
//   { careers_url: string }
//
// Output:
//   {
//     ok: true,
//     careers_url: string,                  // resolved final URL after redirects
//     candidates: Array<{
//       ats: AtsType,                       // matches firms.ats enum
//       ats_config: object,                 // shape matches the parser for that ATS
//       confidence: 'high' | 'medium' | 'low',
//       evidence: string[],                 // human-readable reasoning
//       sample?: { title: string, location: string | null, apply_url: string }
//                                            // first job from the live API when we can fetch one
//     }>,
//     vendor_signals: string[],             // every vendor markered on the page (for context)
//     status_code: number
//   }
//
// We return ALL plausible candidates rather than a single winner because
// many marketing careers pages reference multiple ATSes (Bank of America's
// page mentions Avature, Oleeo, and Workday across business lines). The
// operator picks the one matching their target intake.

// deno-lint-ignore-file no-explicit-any

interface DiscoverInput {
  careers_url: string;
}

interface Candidate {
  ats: string;
  ats_config: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  sample?: { title: string; location: string | null; apply_url: string };
}

interface DiscoverResult {
  ok: boolean;
  careers_url: string;
  status_code: number | null;
  candidates: Candidate[];
  vendor_signals: string[];
  error?: string;
}

function log(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'poll-ats-discover', ...payload }));
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const BROWSER_HEADERS = {
  Accept: 'text/html, application/xhtml+xml',
  'Accept-Language': 'en-GB,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

async function fetchHtml(url: string, signal?: AbortSignal): Promise<{ status: number; html: string; finalUrl: string }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal,
  });
  const html = res.ok ? await res.text() : '';
  return { status: res.status, html, finalUrl: res.url || url };
}

// ---------------------------------------------------------------------------
// Vendor patterns and URL extractors
// ---------------------------------------------------------------------------
// Mirrors the careers-scan vendor map but pairs each vendor with an
// extractor that pulls the tenant-specific identifiers (host, slug,
// boardToken, etc) out of the candidate URL.

interface VendorMatch {
  vendor: string;
  urlSamples: string[]; // every URL on the page that matches this vendor
}

function collectAttrUrls(html: string, pageOrigin: string): string[] {
  const urls = new Set<string>();
  const re = /\b(?:href|src|action|data-href|data-url)=["']([^"']{2,500})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1], pageOrigin);
      if (u.protocol === 'http:' || u.protocol === 'https:') urls.add(u.toString());
    } catch {
      // ignore malformed
    }
  }
  return Array.from(urls);
}

function matchVendors(html: string, urls: string[]): Map<string, VendorMatch> {
  const matches = new Map<string, VendorMatch>();
  const remember = (vendor: string, sample: string) => {
    const e = matches.get(vendor) ?? { vendor, urlSamples: [] };
    if (e.urlSamples.length < 6 && !e.urlSamples.includes(sample)) e.urlSamples.push(sample);
    matches.set(vendor, e);
  };

  for (const url of urls) {
    const host = (() => {
      try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
    })();
    if (/\bwd[0-9]+\.myworkdayjobs\.com$/.test(host) || host.endsWith('myworkdayjobs.com')) remember('workday', url);
    else if (host === 'boards.greenhouse.io' || host === 'boards-api.greenhouse.io' || host === 'job-boards.greenhouse.io' || host.endsWith('greenhouse.io')) remember('greenhouse', url);
    else if (host === 'jobs.lever.co' || host.endsWith('lever.co')) remember('lever', url);
    else if (host === 'apply.workable.com' || host.endsWith('workable.com')) remember('workable', url);
    else if (host.endsWith('teamtailor.com')) remember('teamtailor', url);
    else if (host === 'careers.smartrecruiters.com' || host.endsWith('smartrecruiters.com')) remember('smartrecruiters', url);
    else if (host.endsWith('fa.oraclecloud.com') || host.endsWith('fa.ocs.oraclecloud.com') || host.endsWith('fa.us2.oraclecloud.com')) remember('oracle_hcm', url);
    else if (host.endsWith('tal.net')) remember('oleeo', url);
    else if (host.endsWith('avature.net')) remember('avature', url);
    else if (host.endsWith('eightfold.ai')) remember('eightfold', url);
  }

  // Body-text matches as a fallback when an ATS is referenced by name but
  // no link to its host exists (e.g. "powered by Greenhouse" but the actual
  // board is embedded via JS). We don't have URLs here, so the candidate
  // surfaces with low confidence and no auto-extracted config.
  if (!matches.has('greenhouse') && /powered\s+by\s+greenhouse/i.test(html)) {
    remember('greenhouse', '(body text: powered by Greenhouse)');
  }
  if (!matches.has('avature') && /\bavature\b/i.test(html)) {
    remember('avature', '(body text: avature)');
  }
  if (!matches.has('eightfold') && /\beightfold\b/i.test(html)) {
    remember('eightfold', '(body text: eightfold)');
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Per-vendor config extractors
// ---------------------------------------------------------------------------
// Each returns a Candidate (or null when extraction failed) given the
// VendorMatch + raw page HTML.

function extractWorkday(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    // URL shape: https://{tenant}.wd{N}.myworkdayjobs.com[/locale]/{site}[/job/...]
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    const host = u.hostname;
    const hostMatch = host.match(/^([a-z0-9-]+)\.(wd[0-9]+)\.myworkdayjobs\.com$/i);
    if (!hostMatch) continue;
    const tenant = hostMatch[1];
    // The first non-locale, non-empty path segment is the site name.
    const segments = u.pathname.split('/').filter(Boolean);
    let site: string | null = null;
    for (const seg of segments) {
      if (/^[a-z]{2}-[A-Z]{2}$/.test(seg) || /^[a-z]{2}_[A-Z]{2}$/.test(seg)) continue; // locale
      if (seg === 'job' || seg === 'apply') break;
      site = seg;
      break;
    }
    if (!site) continue;
    return {
      ats: 'workday',
      ats_config: { host, tenant, site },
      confidence: 'high',
      evidence: [
        `Workday host detected: ${host}`,
        `Tenant: ${tenant}`,
        `Site: ${site} (first non-locale path segment)`,
      ],
    };
  }
  return null;
}

function extractGreenhouse(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    // Patterns:
    //   https://boards.greenhouse.io/{boardToken}[/...]
    //   https://job-boards.greenhouse.io/embed/job_board?for={boardToken}
    //   https://boards-api.greenhouse.io/v1/boards/{boardToken}/...
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (u.hostname === 'boards.greenhouse.io' || u.hostname === 'job-boards.greenhouse.io') {
      const forParam = u.searchParams.get('for');
      const firstSeg = u.pathname.split('/').filter(Boolean)[0];
      const candidate = forParam ?? firstSeg;
      if (candidate && candidate !== 'embed') {
        return {
          ats: 'greenhouse',
          ats_config: { boardToken: candidate },
          confidence: 'high',
          evidence: [`Greenhouse board host: ${u.hostname}`, `boardToken: ${candidate}`],
        };
      }
    }
    if (u.hostname === 'boards-api.greenhouse.io') {
      const m = u.pathname.match(/^\/v1\/boards\/([^/]+)/);
      if (m) {
        return {
          ats: 'greenhouse',
          ats_config: { boardToken: m[1] },
          confidence: 'high',
          evidence: [`Greenhouse API URL: ${url}`, `boardToken: ${m[1]}`],
        };
      }
    }
  }
  // Body-text-only fallback: greenhouse referenced but no usable URL.
  if (match.urlSamples.some((s) => s.startsWith('(body text'))) {
    return {
      ats: 'greenhouse',
      ats_config: {},
      confidence: 'low',
      evidence: [
        '"Powered by Greenhouse" text found but no board URL exposed in HTML',
        'Look for an embedded iframe in the live page (View Source / Network tab)',
      ],
    };
  }
  return null;
}

function extractLever(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (u.hostname === 'jobs.lever.co') {
      const slug = u.pathname.split('/').filter(Boolean)[0];
      if (slug) {
        return {
          ats: 'lever',
          ats_config: { companySlug: slug },
          confidence: 'high',
          evidence: [`Lever URL: ${url}`, `companySlug: ${slug}`],
        };
      }
    }
  }
  return null;
}

function extractWorkable(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (u.hostname === 'apply.workable.com') {
      const slug = u.pathname.split('/').filter(Boolean)[0];
      if (slug) {
        return {
          ats: 'workable',
          ats_config: { slug },
          confidence: 'high',
          evidence: [`Workable URL: ${url}`, `slug: ${slug}`],
        };
      }
    }
  }
  return null;
}

function extractTeamTailor(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    // {slug}.teamtailor.com or career-{slug}.teamtailor.com
    const m = u.hostname.match(/^([a-z0-9-]+)\.teamtailor(?:-cdn)?\.com$/i);
    if (m && m[1] !== 'assets-aws' && m[1] !== 'images' && m[1] !== 'videos') {
      return {
        ats: 'teamtailor',
        ats_config: { slug: m[1] },
        confidence: 'high',
        evidence: [`TeamTailor host: ${u.hostname}`, `slug: ${m[1]}`],
      };
    }
  }
  return null;
}

function extractSmartRecruiters(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    // careers.smartrecruiters.com/{slug}[/...]
    if (u.hostname === 'careers.smartrecruiters.com' || u.hostname === 'jobs.smartrecruiters.com') {
      const slug = u.pathname.split('/').filter(Boolean)[0];
      if (slug) {
        return {
          ats: 'smartrecruiters',
          ats_config: { companySlug: slug },
          confidence: 'high',
          evidence: [`SmartRecruiters URL: ${url}`, `companySlug: ${slug}`],
        };
      }
    }
  }
  return null;
}

function extractOracleHcm(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    // Apply URL pattern:
    //   /hcmUI/CandidateExperience/{lang}/sites/{siteNumber}/job/{id}
    const m = u.pathname.match(/\/hcmUI\/CandidateExperience\/[a-zA-Z_-]+\/sites\/([^/]+)/);
    const siteNumber = m?.[1];
    if (siteNumber) {
      return {
        ats: 'oracle_hcm',
        ats_config: { host: u.hostname, siteNumber },
        confidence: 'high',
        evidence: [`Oracle HCM URL: ${url}`, `host: ${u.hostname}`, `siteNumber: ${siteNumber}`],
      };
    }
  }
  // Host detected but no CandidateExperience path on the marketing page —
  // surface as medium confidence with the host only. Operator can probe
  // /hcmUI/CandidateExperience/en/sites to discover sites manually.
  const oracleUrl = match.urlSamples.find((s) => {
    try { return new URL(s).hostname.endsWith('oraclecloud.com'); } catch { return false; }
  });
  if (oracleUrl) {
    return {
      ats: 'oracle_hcm',
      ats_config: { host: new URL(oracleUrl).hostname, siteNumber: 'CX_TBD' },
      confidence: 'medium',
      evidence: [
        `Oracle HCM host detected (${new URL(oracleUrl).hostname}) but no CandidateExperience path on this page`,
        'Find siteNumber by browsing the candidate site directly (URL ends /sites/{siteNumber}/jobs)',
      ],
    };
  }
  return null;
}

function extractOleeo(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    // /vx/lang-{loc}/mobile-0/appcentre-{appcentreId}/brand-{brandId}/candidate/jobboard/vacancy/{boardId}
    const m = u.pathname.match(/\/appcentre-([^/]+)\/brand-([^/]+).*?\/vacancy\/(\d+)/);
    if (m) {
      return {
        ats: 'oleeo',
        ats_config: {
          host: u.hostname,
          appcentreId: m[1],
          brandId: m[2],
          boardIds: [Number(m[3])],
        },
        confidence: 'high',
        evidence: [
          `Oleeo URL: ${url}`,
          `host: ${u.hostname}`,
          `appcentreId: ${m[1]}, brandId: ${m[2]}, boardIds: [${m[3]}]`,
          'Probe boardIds [1..6] on the live tenant if the runner reports board_missing — many tenants have 2-3 boards.',
        ],
      };
    }
  }
  // Host-only detection — operator must research the appcentre+brand+board ids.
  const oleeoUrl = match.urlSamples.find((s) => {
    try { return new URL(s).hostname.endsWith('tal.net'); } catch { return false; }
  });
  if (oleeoUrl) {
    return {
      ats: 'oleeo',
      ats_config: { host: new URL(oleeoUrl).hostname, appcentreId: '1', brandId: '1', boardIds: [1, 2, 3] },
      confidence: 'medium',
      evidence: [
        `Oleeo host detected (${new URL(oleeoUrl).hostname}) but no /appcentre-N/brand-M/vacancy/K path on this page`,
        'Browse the candidate site to capture the appcentreId/brandId from the URL',
      ],
    };
  }
  return null;
}

function extractAvature(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (!u.hostname.endsWith('avature.net')) continue;
    return {
      ats: 'avature',
      ats_config: {
        host: u.hostname,
        // Default to the Macquarie convention as a starting point; the
        // operator must verify on the live site (HSBC uses pipeline*).
        searchPath: '/careers/SearchJobs',
        recordsParam: 'jobRecordsPerPage',
        offsetParam: 'jobOffset',
        detailPathToken: 'JobDetail',
        pageSize: 50,
      },
      confidence: 'medium',
      evidence: [
        `Avature host detected: ${u.hostname}`,
        'searchPath/recordsParam/offsetParam are best-guess defaults (Macquarie convention)',
        'Verify against the live site — HSBC uses pipelineRecordsPerPage/PipelineDetail; others vary.',
      ],
    };
  }
  // Body-text only — surface low confidence
  return {
    ats: 'avature',
    ats_config: {},
    confidence: 'low',
    evidence: [
      '"Avature" referenced in the page body but no avature.net link exposed',
      'Likely on a vanity domain (apply.{firm}.com, mycareer.{firm}.com). Inspect Network tab to find the actual host.',
    ],
  };
}

function extractEightfold(match: VendorMatch): Candidate | null {
  for (const url of match.urlSamples) {
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (!u.hostname.endsWith('eightfold.ai')) continue;
    // The domain param for the JSON API is the company's primary domain.
    // We don't know it from the URL alone — best guess: strip the
    // ".eightfold.ai" suffix and append ".com".
    const subdomain = u.hostname.replace(/\.eightfold\.ai$/, '');
    const domain = `${subdomain}.com`;
    return {
      ats: 'eightfold',
      ats_config: { host: u.hostname, domain },
      confidence: 'medium',
      evidence: [
        `Eightfold host: ${u.hostname}`,
        `domain (best guess): ${domain} — verify; some tenants use a different brand domain`,
        'Note: Citi gates /api/apply/v2/jobs with PCSX auth even from clean requests; not all Eightfold tenants are pollable.',
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sample-job fetcher: for high-confidence candidates, try to fetch one real
// job from the ATS API so the operator can confirm the config works before
// saving.
// ---------------------------------------------------------------------------

async function sampleFor(candidate: Candidate, signal?: AbortSignal): Promise<Candidate['sample'] | undefined> {
  try {
    if (candidate.ats === 'workday') {
      const cfg = candidate.ats_config as { host: string; tenant: string; site: string };
      const res = await fetch(`https://${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...BROWSER_HEADERS },
        body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
      });
      if (!res.ok) return undefined;
      const json = await res.json() as { jobPostings?: { title?: string; locationsText?: string; externalPath?: string }[] };
      const j = json.jobPostings?.[0];
      if (!j?.title || !j.externalPath) return undefined;
      return { title: j.title, location: j.locationsText ?? null, apply_url: `https://${cfg.host}/${cfg.site}${j.externalPath}` };
    }
    if (candidate.ats === 'greenhouse') {
      const cfg = candidate.ats_config as { boardToken?: string };
      if (!cfg.boardToken) return undefined;
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${cfg.boardToken}/jobs`, { signal, headers: BROWSER_HEADERS });
      if (!res.ok) return undefined;
      const json = await res.json() as { jobs?: { title?: string; location?: { name?: string }; absolute_url?: string }[] };
      const j = json.jobs?.[0];
      if (!j?.title || !j.absolute_url) return undefined;
      return { title: j.title, location: j.location?.name ?? null, apply_url: j.absolute_url };
    }
    if (candidate.ats === 'lever') {
      const cfg = candidate.ats_config as { companySlug: string };
      const res = await fetch(`https://api.lever.co/v0/postings/${cfg.companySlug}?mode=json`, { signal, headers: BROWSER_HEADERS });
      if (!res.ok) return undefined;
      const json = await res.json() as { text?: string; categories?: { location?: string }; hostedUrl?: string }[];
      const j = json[0];
      if (!j?.text || !j.hostedUrl) return undefined;
      return { title: j.text, location: j.categories?.location ?? null, apply_url: j.hostedUrl };
    }
    if (candidate.ats === 'smartrecruiters') {
      const cfg = candidate.ats_config as { companySlug: string };
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(cfg.companySlug)}/postings?limit=1`, { signal, headers: BROWSER_HEADERS });
      if (!res.ok) return undefined;
      const json = await res.json() as { content?: { id?: string; name?: string; location?: { fullLocation?: string } }[] };
      const p = json.content?.[0];
      if (!p?.id || !p.name) return undefined;
      return { title: p.name, location: p.location?.fullLocation ?? null, apply_url: `https://jobs.smartrecruiters.com/${cfg.companySlug}/${p.id}` };
    }
  } catch {
    // Sampling is best-effort; if the API rejects us (WAF, auth, schema
    // mismatch) we just omit the sample. The candidate config still ships.
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const EXTRACTORS: Record<string, (m: VendorMatch) => Candidate | null> = {
  workday: extractWorkday,
  greenhouse: extractGreenhouse,
  lever: extractLever,
  workable: extractWorkable,
  teamtailor: extractTeamTailor,
  smartrecruiters: extractSmartRecruiters,
  oracle_hcm: extractOracleHcm,
  oleeo: extractOleeo,
  avature: extractAvature,
  eightfold: extractEightfold,
};

async function discover(careersUrl: string): Promise<DiscoverResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('discover timeout')), 15_000);
  try {
    const { status, html, finalUrl } = await fetchHtml(careersUrl, ctrl.signal);
    if (!status || status >= 400) {
      return {
        ok: false,
        careers_url: finalUrl,
        status_code: status,
        candidates: [],
        vendor_signals: [],
        error: `HTTP_${status}`,
      };
    }
    const attrUrls = collectAttrUrls(html, finalUrl);
    const matches = matchVendors(html, attrUrls);
    const vendorSignals = Array.from(matches.keys()).sort();

    const candidates: Candidate[] = [];
    for (const match of matches.values()) {
      const extractor = EXTRACTORS[match.vendor];
      if (!extractor) continue;
      const c = extractor(match);
      if (c) candidates.push(c);
    }

    // Add live samples in parallel for every high-confidence candidate.
    await Promise.all(candidates.map(async (c) => {
      if (c.confidence !== 'high') return;
      c.sample = await sampleFor(c, ctrl.signal);
    }));

    // Sort by confidence DESC, then alphabetically by ats.
    candidates.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      const r = order[a.confidence] - order[b.confidence];
      return r !== 0 ? r : a.ats.localeCompare(b.ats);
    });

    return {
      ok: true,
      careers_url: finalUrl,
      status_code: status,
      candidates,
      vendor_signals: vendorSignals,
    };
  } catch (err) {
    return {
      ok: false,
      careers_url: careersUrl,
      status_code: null,
      candidates: [],
      vendor_signals: [],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  try {
    let careersUrl: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json() as DiscoverInput;
        careersUrl = body.careers_url ?? null;
      } catch {
        // Fall through to query string
      }
    }
    const url = new URL(req.url);
    if (!careersUrl) careersUrl = url.searchParams.get('careers_url');
    if (!careersUrl) {
      return Response.json({ ok: false, error: 'missing_careers_url' }, { status: 400 });
    }
    try {
      const parsed = new URL(careersUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return Response.json({ ok: false, error: 'invalid_protocol' }, { status: 400 });
      }
    } catch {
      return Response.json({ ok: false, error: 'invalid_url' }, { status: 400 });
    }
    const result = await discover(careersUrl);
    log({ event: 'discover_complete', careers_url: careersUrl, candidates: result.candidates.length });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ level: 'error', event: 'discover_failed', error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
