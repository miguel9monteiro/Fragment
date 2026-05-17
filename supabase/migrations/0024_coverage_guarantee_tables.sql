-- Tier-3 coverage guarantees. Two new tables + four RPCs plus a watchdog
-- detection rule (added in the watchdog Edge Function code) that catch
-- *silent* drift — situations where the fleet looks healthy on the surface
-- but coverage is decaying:
--
--   firm_volume_snapshots
--     Daily snapshot of (firm_id, open_count). Used to build a rolling p50
--     baseline. The watchdog compares the firm's current open_count against
--     its baseline and raises firm_volume_drop when current < 0.3 × p50.
--     Catches WAF outages we'd otherwise miss (the firm errored 100 times,
--     no new jobs, but no error spike either because we'd reclassified all
--     historical roles a week ago).
--
--   firm_careers_snapshots
--     Weekly snapshot of each firm's careers_url page: status, content
--     hash, distinct external hosts referenced, and ATS-vendor signals
--     (Workday/Greenhouse/Lever/Avature/Oleeo/.tal.net/Eightfold/iCIMS/...)
--     extracted from URLs and text. The poll-careers-scan function diffs
--     consecutive snapshots and raises firm_careers_drift when ATS signals
--     change — the canonical signal that a firm has migrated ATSes (HSBC
--     adding a banner pointing at portal.careers.hsbc.com is the worked
--     example we want to catch within a week of it appearing).
--
-- Both tables are admin-surface only (RLS denies all). Future /admin UI
-- reads via the service role.

-- =========================================================================
-- 1. firm_volume_snapshots
-- =========================================================================

create table public.firm_volume_snapshots (
  id bigserial primary key,
  firm_id uuid references public.firms(id) on delete cascade,
  firm_slug text,
  open_count int not null,
  snapshot_at timestamptz not null default now()
);

-- Per-firm tail scan: used by the volume-drop detector + the future
-- admin UI's per-firm "30-day volume" sparkline.
create index firm_volume_snapshots_firm_idx
  on public.firm_volume_snapshots (firm_id, snapshot_at desc);

-- Global tail scan: used by retention if we ever add one. Snapshots are
-- tiny (50 firms × 365 = 18k/year), so retention is currently unbounded.
create index firm_volume_snapshots_snapshot_at_idx
  on public.firm_volume_snapshots (snapshot_at desc);

alter table public.firm_volume_snapshots enable row level security;

comment on table public.firm_volume_snapshots is
  'Daily snapshot of (firm_id, open_count) used to build a rolling p50 '
  'baseline for the watchdog''s firm_volume_drop detector. Written by the '
  'snapshot_firm_volumes() RPC on a 05:00 UTC cron. No retention — 50 '
  'firms × 365 days = ~18k rows/year is negligible.';

-- =========================================================================
-- 2. firm_careers_snapshots
-- =========================================================================

create table public.firm_careers_snapshots (
  id bigserial primary key,
  firm_id uuid references public.firms(id) on delete cascade,
  firm_slug text,
  url text not null,
  status_code int,
  -- SHA-256 over the response body. Stored for forensic comparison; drift
  -- detection uses signals_hash because raw content has marketing-copy noise
  -- that flickers without signaling a real change.
  content_hash text,
  -- Distinct external hosts referenced in href/src/action attrs on the page.
  -- "External" = different eTLD+1 than the careers_url host. This is the
  -- signal that catches "firm migrated their candidate flow to a new
  -- domain" — the new domain shows up here.
  external_hosts text[] not null default array[]::text[],
  -- Recognised ATS-vendor markers extracted from external_hosts + body text
  -- (e.g. 'workday', 'eightfold', 'avature'). Drift detection diffs this
  -- array; a new entry == probable migration.
  ats_signals text[] not null default array[]::text[],
  -- SHA-256 over (external_hosts || ats_signals) sorted. Diff target.
  signals_hash text,
  snapshot_at timestamptz not null default now()
);

create index firm_careers_snapshots_firm_idx
  on public.firm_careers_snapshots (firm_id, snapshot_at desc);

alter table public.firm_careers_snapshots enable row level security;

comment on table public.firm_careers_snapshots is
  'Weekly snapshot of each firm''s careers_url page with extracted ATS '
  'signals. Written by poll-careers-scan on a Saturday 02:00 UTC cron. '
  'The function diffs consecutive snapshots and raises firm_careers_drift '
  'when ats_signals changes — catches firm migrations between ATSes.';

-- =========================================================================
-- 3. snapshot_firm_volumes() — used by daily cron
-- =========================================================================

create or replace function public.snapshot_firm_volumes()
returns int
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_count int;
begin
  insert into public.firm_volume_snapshots (firm_id, firm_slug, open_count)
  select f.id, f.slug, coalesce(j.cnt, 0)
  from public.firms f
  left join (
    select firm_id, count(*) as cnt
    from public.jobs
    where closed_at is null
    group by firm_id
  ) j on j.firm_id = f.id
  where f.active = true;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

comment on function public.snapshot_firm_volumes() is
  'Snapshot the current open-job count for every active firm. Idempotent: '
  'safe to re-run (just adds another row). Called by cron at 05:00 UTC.';

-- =========================================================================
-- 4. watchdog_volume_drop_candidates() — used by the watchdog
-- =========================================================================
-- Computes per-firm baseline (p50) over the supplied window, joins with
-- the live open-count from jobs, and returns only rows that meet the drop
-- criteria. All thresholds are parameters so the watchdog can tune without
-- a migration.

create or replace function public.watchdog_volume_drop_candidates(
  p_since timestamptz,
  p_min_samples int default 7,
  p_drop_factor numeric default 0.3,
  p_min_baseline numeric default 5
)
returns table (
  firm_id uuid,
  firm_slug text,
  current_count bigint,
  baseline_p50 numeric,
  samples bigint
)
language sql
security definer
set search_path = 'public', 'pg_temp'
stable
as $function$
  with live as (
    select firm_id, count(*)::bigint as open_count
    from public.jobs
    where closed_at is null and firm_id is not null
    group by firm_id
  ),
  baseline as (
    select firm_id, firm_slug,
           percentile_cont(0.5) within group (order by open_count)::numeric as p50,
           count(*)::bigint as samples
    from public.firm_volume_snapshots
    where snapshot_at >= p_since and firm_id is not null
    group by firm_id, firm_slug
    having count(*) >= p_min_samples
       and percentile_cont(0.5) within group (order by open_count) >= p_min_baseline
  )
  select b.firm_id, b.firm_slug,
         coalesce(l.open_count, 0) as current_count,
         b.p50 as baseline_p50,
         b.samples
  from baseline b
  left join live l on l.firm_id = b.firm_id
  where coalesce(l.open_count, 0)::numeric < (p_drop_factor * b.p50);
$function$;

comment on function public.watchdog_volume_drop_candidates(timestamptz, int, numeric, numeric) is
  'Returns firms whose live open-job count is below p_drop_factor × their '
  'rolling p50 baseline. Used by the watchdog firm_volume_drop detector.';

-- =========================================================================
-- 5. One-time backfill: seed an initial snapshot for every active firm.
-- =========================================================================
-- Without this, the watchdog has no data to compare against until the daily
-- cron has fired enough times (>= p_min_samples=7) to build a baseline.
-- The single seed row gets us 1 data point immediately; the 0.3 × p50
-- threshold still requires 7+ samples before it fires, so this is purely a
-- head-start for the first weeks of operation.

select public.snapshot_firm_volumes();
