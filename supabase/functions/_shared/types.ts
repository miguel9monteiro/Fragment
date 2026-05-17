// Shared types for ATS pollers. The runner accepts a fetcher per ATS that
// returns NormalizedPosting[]; everything downstream (UK filter, classify,
// upsert, close stale) operates on the normalized shape, so adding a new ATS
// only requires a new fetcher and a config parser, never touching the runner.

export interface FirmRow {
  id: string;
  slug: string;
  name: string;
  ats: string;
  ats_config: unknown;
  active: boolean;
}

export interface NormalizedPosting {
  // Stable, ATS-provided ID. Unique per firm. Used as jobs.external_id.
  externalId: string;
  title: string;
  // Human-readable location string for jobs.location. Null if the ATS does
  // not surface one. NOT used for the UK filter -- use `searchText` for that.
  location: string | null;
  applyUrl: string;
  // ISO 8601 timestamp if the ATS exposes a posted date. Null otherwise.
  postedAt: string | null;
  // Concatenated locational signal (city/country/region/title fallback) used
  // by the UK filter via isUkLocation(). Do NOT stuff long body descriptions
  // in here -- false positives from "we have a London office" boilerplate.
  searchText: string;
  // Original ATS payload, persisted to jobs.raw for debugging.
  raw: unknown;
}

export interface FirmResult {
  firm: string;
  fetched: number;
  uk: number;
  // Rows touched by the upsert (insert or update). Split is not tracked because
  // doing so requires an extra round-trip that the latency budget can't afford.
  upserted: number;
  closed: number;
  ms: number;
  error?: string;
}

// Per-ATS fetcher contract. Throws on transport or parse failure; the runner
// catches and records the error per firm so one bad tenant cannot abort a run.
// The optional AbortSignal is wired from the runner's per-firm timeout; pass
// it through to fetch() so the underlying request actually stops, not just
// the awaiting promise.
export type Fetcher = (firm: FirmRow, signal?: AbortSignal) => Promise<NormalizedPosting[]>;
