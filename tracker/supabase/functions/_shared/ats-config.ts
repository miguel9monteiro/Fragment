// Discriminated union for firms.ats_config payloads. Each ATS family has its
// own runtime parser so the poller fails loudly on misconfig rather than
// silently 404ing in production.

export interface WorkdayConfig {
  host: string;
  tenant: string;
  site: string;
  ukFacet?: string;
  note?: string;
}

export interface AvatureConfig {
  // Avature is HTML-only — no public JSON API. We GET the search page and parse
  // job cards out of the HTML. Param names are tenant-customisable, hence
  // every knob below lives in ats_config.
  //
  // Example for HSBC:
  //   host:            "mycareer.hsbc.com"
  //   searchPath:      "/en_GB/external/SearchJobs"
  //   recordsParam:    "pipelineRecordsPerPage"
  //   offsetParam:     "pipelineOffset"
  //   detailPathToken: "PipelineDetail"
  // Example for Macquarie:
  //   host:            "recruitment.macquarie.com"
  //   searchPath:      "/en_US/careers/SearchJobs"
  //   recordsParam:    "jobRecordsPerPage"
  //   offsetParam:     "jobOffset"
  //   detailPathToken: "JobDetail"
  host: string;
  searchPath: string;
  recordsParam: string;
  offsetParam: string;
  // Substring that appears in every job-detail href on this tenant (e.g.
  // "PipelineDetail", "JobDetail"). Used as a regex anchor when scraping
  // anchors out of the HTML response. Required so we don't pick up navigation
  // links that happen to live near the job list.
  detailPathToken: string;
  // Optional explicit page size (default 50). Some tenants cap below 50.
  pageSize?: number;
  // Optional cap on pages fetched per run — defensive against runaway pagination.
  maxPages?: number;
  note?: string;
}

export interface OleeoConfig {
  // Oleeo (formerly WCN) hosts every tenant on a *.tal.net subdomain and
  // exposes a public RSS 2.0 feed per "vacancy board" under the same tenant.
  // Each tenant typically has multiple boards (e.g. experienced vs campus);
  // we model them as `boardIds: number[]` and the fetcher merges across boards.
  //
  // Feed URL shape (per board):
  //   https://{host}/vx/lang-en-GB/mobile-0/appcentre-{appcentreId}/brand-{brandId}/candidate/jobboard/vacancy/{boardId}/feed
  //
  // Example for Goldman Sachs (experienced + events boards):
  //   host:         "goldmansachs.tal.net"
  //   appcentreId:  "1"
  //   brandId:      "2"
  //   boardIds:     [1, 2, 6]
  host: string;
  appcentreId: string;
  brandId: string;
  boardIds: number[];
  note?: string;
}

export interface EightfoldConfig {
  // SmartApply public JSON API at https://{host}/api/apply/v2/jobs.
  // `domain` is the tenant-specific company identifier passed as a required
  // query param (Citi -> "citi.com"). `pageSize` defaults to 25; reliable up
  // to 50, some tenants cap.
  host: string;
  domain: string;
  pageSize?: number;
  note?: string;
}

export interface SmartRecruitersConfig {
  companySlug: string;
  note?: string;
}

export interface GreenhouseConfig {
  // Stable token used in https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs.
  // It is whatever appears after /boards/ on the embedded careers page,
  // e.g. "flowtraders" for Flow Traders or "alphasights" for AlphaSights.
  boardToken: string;
  note?: string;
}

export interface LeverConfig {
  // The slug used in https://api.lever.co/v0/postings/{companySlug}?mode=json.
  // Matches the path segment in jobs.lever.co/{slug}.
  companySlug: string;
  // Lever runs EU + global APIs on separate hosts. Most tenants are reachable
  // on the global api.lever.co; a small subset live only on api.eu.lever.co
  // (e.g. SEB). Default 'global' if omitted.
  region?: 'global' | 'eu';
  note?: string;
}

export interface WorkableConfig {
  // The slug from apply.workable.com/{slug}/j/{jobId}. The widget API endpoint
  // is https://apply.workable.com/api/v1/widget/accounts/{slug}.
  slug: string;
  note?: string;
}

export interface TeamTailorConfig {
  // The careers subdomain from {slug}.teamtailor.com. We poll
  // https://{slug}.teamtailor.com/jobs.rss (RSS 2.0) since the public
  // jobs.json endpoint is empty for most tenants.
  slug: string;
  note?: string;
}

export interface CustomHtmlConfig {
  url: string;
  selector: string;
  note?: string;
}

export interface OracleHcmConfig {
  // Oracle HCM Cloud Recruiting tenant host, e.g. "jpmc.fa.oraclecloud.com".
  host: string;
  // Candidate Experience site identifier visible in the apply URL,
  // e.g. "CX_1001" for JPMorgan. Used to build the public apply URL
  // /hcmUI/CandidateExperience/en/sites/{siteNumber}/job/{Id}.
  siteNumber: string;
  // Optional UK GeographyId facet IDs to pre-filter server-side. Oracle HCM
  // caps the requisitionList child collection at 25 rows per page regardless
  // of `limit`, so a full global pagination blows the pg_net 30s budget for
  // any tenant with thousands of reqs (JPM ~7.4k). Each ID is a
  // `selectedLocationsFacet` value the poller fans out over and dedupes by
  // requisition Id. Omit to paginate every req globally — viable only for
  // small tenants.
  selectedLocationsFacets?: string[];
  note?: string;
}

export type AtsConfig =
  | ({ ats: 'workday' } & WorkdayConfig)
  | ({ ats: 'avature' } & AvatureConfig)
  | ({ ats: 'smartrecruiters' } & SmartRecruitersConfig)
  | ({ ats: 'greenhouse' } & GreenhouseConfig)
  | ({ ats: 'lever' } & LeverConfig)
  | ({ ats: 'workable' } & WorkableConfig)
  | ({ ats: 'teamtailor' } & TeamTailorConfig)
  | ({ ats: 'oracle_hcm' } & OracleHcmConfig)
  | ({ ats: 'oleeo' } & OleeoConfig)
  | ({ ats: 'eightfold' } & EightfoldConfig)
  | ({ ats: 'custom_html' } & CustomHtmlConfig);

export class AtsConfigError extends Error {
  constructor(
    message: string,
    public readonly slug: string,
  ) {
    super(`[${slug}] ${message}`);
    this.name = 'AtsConfigError';
  }
}

function asString(value: unknown, key: string, slug: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AtsConfigError(`ats_config.${key} must be a non-empty string`, slug);
  }
  return value;
}

function asObject(raw: unknown, slug: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    throw new AtsConfigError('ats_config must be a JSON object', slug);
  }
  return raw as Record<string, unknown>;
}

export function parseWorkdayConfig(raw: unknown, slug: string): WorkdayConfig {
  const obj = asObject(raw, slug);
  return {
    host: asString(obj.host, 'host', slug),
    tenant: asString(obj.tenant, 'tenant', slug),
    site: asString(obj.site, 'site', slug),
    ukFacet: typeof obj.ukFacet === 'string' ? obj.ukFacet : undefined,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseGreenhouseConfig(raw: unknown, slug: string): GreenhouseConfig {
  const obj = asObject(raw, slug);
  return {
    boardToken: asString(obj.boardToken, 'boardToken', slug),
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseLeverConfig(raw: unknown, slug: string): LeverConfig {
  const obj = asObject(raw, slug);
  const region = obj.region;
  if (region !== undefined && region !== 'global' && region !== 'eu') {
    throw new AtsConfigError(`ats_config.region must be 'global' or 'eu' if set`, slug);
  }
  return {
    companySlug: asString(obj.companySlug, 'companySlug', slug),
    region: region as 'global' | 'eu' | undefined,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseWorkableConfig(raw: unknown, slug: string): WorkableConfig {
  const obj = asObject(raw, slug);
  return {
    slug: asString(obj.slug, 'slug', slug),
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseTeamTailorConfig(raw: unknown, slug: string): TeamTailorConfig {
  const obj = asObject(raw, slug);
  return {
    slug: asString(obj.slug, 'slug', slug),
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseSmartRecruitersConfig(raw: unknown, slug: string): SmartRecruitersConfig {
  const obj = asObject(raw, slug);
  return {
    companySlug: asString(obj.companySlug, 'companySlug', slug),
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseAvatureConfig(raw: unknown, slug: string): AvatureConfig {
  const obj = asObject(raw, slug);
  let pageSize: number | undefined;
  if (obj.pageSize !== undefined) {
    if (typeof obj.pageSize !== 'number' || !Number.isFinite(obj.pageSize) || obj.pageSize <= 0) {
      throw new AtsConfigError(`ats_config.pageSize must be a positive number if set`, slug);
    }
    pageSize = obj.pageSize;
  }
  let maxPages: number | undefined;
  if (obj.maxPages !== undefined) {
    if (typeof obj.maxPages !== 'number' || !Number.isFinite(obj.maxPages) || obj.maxPages <= 0) {
      throw new AtsConfigError(`ats_config.maxPages must be a positive number if set`, slug);
    }
    maxPages = obj.maxPages;
  }
  return {
    host: asString(obj.host, 'host', slug),
    searchPath: asString(obj.searchPath, 'searchPath', slug),
    recordsParam: asString(obj.recordsParam, 'recordsParam', slug),
    offsetParam: asString(obj.offsetParam, 'offsetParam', slug),
    detailPathToken: asString(obj.detailPathToken, 'detailPathToken', slug),
    pageSize,
    maxPages,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseOleeoConfig(raw: unknown, slug: string): OleeoConfig {
  const obj = asObject(raw, slug);
  const boardIdsRaw = obj.boardIds;
  if (!Array.isArray(boardIdsRaw) || boardIdsRaw.length === 0) {
    throw new AtsConfigError(`ats_config.boardIds must be a non-empty array of numbers`, slug);
  }
  const boardIds: number[] = [];
  for (const v of boardIdsRaw) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
      throw new AtsConfigError(`ats_config.boardIds entries must be positive integers`, slug);
    }
    boardIds.push(v);
  }
  return {
    host: asString(obj.host, 'host', slug),
    appcentreId: asString(obj.appcentreId, 'appcentreId', slug),
    brandId: asString(obj.brandId, 'brandId', slug),
    boardIds,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseEightfoldConfig(raw: unknown, slug: string): EightfoldConfig {
  const obj = asObject(raw, slug);
  let pageSize: number | undefined;
  if (obj.pageSize !== undefined) {
    if (typeof obj.pageSize !== 'number' || !Number.isFinite(obj.pageSize) || obj.pageSize <= 0) {
      throw new AtsConfigError(`ats_config.pageSize must be a positive number if set`, slug);
    }
    pageSize = obj.pageSize;
  }
  return {
    host: asString(obj.host, 'host', slug),
    domain: asString(obj.domain, 'domain', slug),
    pageSize,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}

export function parseOracleHcmConfig(raw: unknown, slug: string): OracleHcmConfig {
  const obj = asObject(raw, slug);
  let selectedLocationsFacets: string[] | undefined;
  const facets = obj.selectedLocationsFacets;
  if (facets !== undefined) {
    if (!Array.isArray(facets)) {
      throw new AtsConfigError(`ats_config.selectedLocationsFacets must be an array of strings`, slug);
    }
    const out: string[] = [];
    for (const v of facets) {
      if (typeof v !== 'string' || v.length === 0) {
        throw new AtsConfigError(`ats_config.selectedLocationsFacets entries must be non-empty strings`, slug);
      }
      out.push(v);
    }
    if (out.length > 0) selectedLocationsFacets = out;
  }
  return {
    host: asString(obj.host, 'host', slug),
    siteNumber: asString(obj.siteNumber, 'siteNumber', slug),
    selectedLocationsFacets,
    note: typeof obj.note === 'string' ? obj.note : undefined,
  };
}
