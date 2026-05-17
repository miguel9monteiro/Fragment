-- Tier-0 observability foundation: per-firm-per-run telemetry + persistent
-- alerts. Today every poller failure is silent — secret missing, WAF block,
-- bad host, parser mismatch — and we only notice when the UI looks empty.
-- These two tables (plus the watchdog Edge Function added in a later
-- migration) close that gap.
--
--   poller_runs   one row per firm per run. Cheap append-only audit log.
--                 ~80k rows/day fleet-wide, pruned to 30 days by cron.
--   system_alerts one row per *active* problem. Idempotent: at most one
--                 open alert of each (kind, firm_id) at a time, enforced
--                 by a partial unique index. Closed by setting resolved_at.
--
-- Both tables are admin-surface only: service role can read/write, end users
-- cannot see them at all (RLS denies all). Future /admin UI reads via the
-- service-role connection.

-- =========================================================================
-- 1. poller_runs
-- =========================================================================

create table public.poller_runs (
  id bigserial primary key,
  -- Nullable so we can also record fleet-level events (e.g. cron tick with
  -- zero firms loaded) once future detectors emit them. Per-firm runs always
  -- carry a non-null firm_id.
  firm_id uuid references public.firms(id) on delete cascade,
  -- Denormalised slug. Avoids a JOIN in every watchdog and admin query, and
  -- preserves history even if a firm is hard-deleted (the FK above is also
  -- ON DELETE CASCADE so this is belt-and-braces — see prune function).
  firm_slug text,
  source text not null,                    -- e.g. 'poll-workday'
  fetched int not null default 0,
  uk int not null default 0,
  upserted int not null default 0,
  closed int not null default 0,
  ms int not null default 0,
  error text,
  ran_at timestamptz not null default now()
);

-- Per-firm tail scan: used by the firm-error and zero-UK detectors.
create index poller_runs_firm_ran_at_idx
  on public.poller_runs (firm_id, ran_at desc);

-- Per-source tail scan: used by fleet-silent detector + admin "show me the
-- last 100 Workday runs" view.
create index poller_runs_source_ran_at_idx
  on public.poller_runs (source, ran_at desc);

-- Global tail scan: used by the prune job.
create index poller_runs_ran_at_idx
  on public.poller_runs (ran_at desc);

alter table public.poller_runs enable row level security;

-- No anon / authenticated policies. Service role only.
comment on table public.poller_runs is
  'Per-firm-per-run telemetry. Written by the shared poll-runner after each '
  'firm batch. Read by the watchdog and the /admin UI. Pruned to 30 days '
  'by the nightly retention cron.';

-- =========================================================================
-- 2. system_alerts
-- =========================================================================

create table public.system_alerts (
  id bigserial primary key,
  level text not null check (level in ('info', 'warn', 'error', 'critical')),
  -- Stable enum-ish discriminator the watchdog uses to dedupe.
  -- Known kinds:
  --   firm_errors    — N consecutive errors on this (firm, source)
  --   firm_zero_uk   — fetched > 0 but uk = 0 over a long window
  --   fleet_silent   — fleet-wide upserted = 0 over 30 min
  --   vault_missing  — _invoke_poller couldn't find project_url or service_role_key
  kind text not null,
  firm_id uuid references public.firms(id) on delete cascade,
  message text not null,
  detail jsonb default '{}'::jsonb,
  raised_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

-- Lookups: "show me every open alert" — the dashboard's primary query.
create index system_alerts_open_idx
  on public.system_alerts (raised_at desc)
  where resolved_at is null;

-- Idempotency: AT MOST ONE open alert of each (kind, firm_id) at a time.
-- coalesce on firm_id::text so fleet-level alerts (firm_id is null) also
-- have a uniqueness slot.
create unique index system_alerts_unique_open_idx
  on public.system_alerts (kind, coalesce(firm_id::text, '_fleet_'))
  where resolved_at is null;

alter table public.system_alerts enable row level security;

comment on table public.system_alerts is
  'Persistent alerts surfaced by the watchdog and the _invoke_poller vault '
  'guard. At most one open alert of each (kind, firm_id). Closed by setting '
  'resolved_at on transition.';

-- =========================================================================
-- 3. Retention
-- =========================================================================
-- poller_runs writes ~80k rows/day fleet-wide; at 30 days that's ~2.4M rows
-- which Postgres handles fine, but the prune keeps the table hot and the
-- indices tight. Called by a cron job scheduled in a later migration.

create or replace function public.prune_poller_runs(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_deleted int;
begin
  delete from public.poller_runs
  where ran_at < (now() - make_interval(days => p_days));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

comment on function public.prune_poller_runs(int) is
  'Delete poller_runs rows older than p_days (default 30). Called by cron.';

-- =========================================================================
-- 4. Watchdog server-side aggregate
-- =========================================================================
-- The firm_zero_uk detector needs per-(firm, source) sums over a 7-day
-- window, which spans ~560k rows. Shipping that to the Edge function over
-- PostgREST is wasteful when the answer is a handful of (firm, source) pairs.
-- This RPC does the aggregate server-side and returns only the candidates.
--
-- The watchdog falls back to a client-side aggregate over a smaller window
-- if this RPC is absent (e.g. during a rollback), so it stays compatible
-- with older deployments.

create or replace function public.watchdog_firm_zero_uk_candidates(
  p_since timestamptz,
  p_min_runs int default 100
)
returns table (
  firm_id uuid,
  firm_slug text,
  source text,
  runs bigint,
  fetched bigint,
  uk bigint
)
language sql
security definer
set search_path = 'public', 'pg_temp'
stable
as $function$
  select
    pr.firm_id,
    pr.firm_slug,
    pr.source,
    count(*)::bigint as runs,
    sum(pr.fetched)::bigint as fetched,
    sum(pr.uk)::bigint as uk
  from public.poller_runs pr
  where pr.ran_at >= p_since
    and pr.firm_id is not null
  group by pr.firm_id, pr.firm_slug, pr.source
  having count(*) >= p_min_runs
     and sum(pr.fetched) > 0
     and sum(pr.uk) = 0;
$function$;

comment on function public.watchdog_firm_zero_uk_candidates(timestamptz, int) is
  'Per-(firm, source) aggregate over poller_runs for the firm_zero_uk '
  'detector. Returns only the rows that match (runs >= p_min_runs AND '
  'fetched > 0 AND uk = 0).';
