-- Tier-2 self-healing: per-firm exponential backoff state.
--
-- Today every active firm polls on the same cadence regardless of whether
-- it's been erroring for 5 minutes or 5 hours. That has two costs:
--   1. WAF triggers: when 24 Workday firms burst from one Edge IP per
--      minute, Workday's WAF blocks the IP. The block re-triggers on every
--      subsequent tick because we don't back off.
--   2. Latency budget waste: each errored firm consumes ~400ms of the
--      per-firm timeout. 24 firms × 60 ticks = 575s/hour spent erroring.
--
-- Four new columns on firms encode the per-firm state:
--
--   next_run_after        when the runner should next attempt this firm
--                         (NULL = run on every tick).
--   consecutive_errors    counter, incremented on each failure, reset on
--                         success.
--   last_error_at         timestamp of most recent error (for the digest
--                         and admin UI).
--   last_success_at       timestamp of most recent success.
--
-- Backoff schedule (computed in the runner):
--   error #1  -> 2 min
--   error #2  -> 4 min
--   error #3  -> 8 min
--   error #4  -> 16 min
--   error #5  -> 32 min
--   error #6+ -> 60 min cap
--
-- One success resets everything to defaults. The watchdog's firm_errors
-- detector still fires on 3 consecutive errors because the LAST 3 runs are
-- examined regardless of cadence — backoff only changes how often we try,
-- not whether we surface the failure.
--
-- The bulk update RPC at the bottom lets the runner persist N firms' state
-- in a single round-trip per cron tick.

alter table public.firms
  add column if not exists next_run_after timestamptz,
  add column if not exists consecutive_errors int not null default 0,
  add column if not exists last_error_at timestamptz,
  add column if not exists last_success_at timestamptz;

-- Fast path for "active firms ready to run now". The partial index excludes
-- inactive rows (already a small subset, but the firms table is hot enough
-- that even saving a few rows on every cron tick matters as we grow).
create index if not exists firms_runnable_idx
  on public.firms (ats, next_run_after)
  where active = true;

-- Bulk update used by the runner. Accepts a JSONB array shaped like:
--   [{"id": "<uuid>", "consecutive_errors": 3,
--     "next_run_after": "2026-05-17T16:00:00Z" | null,
--     "last_error_at":   "2026-05-17T15:58:00Z" | null,
--     "last_success_at": "2026-05-17T15:30:00Z" | null}, ...]
--
-- NULL fields use COALESCE so a per-tick update doesn't erase a stale value
-- from a previous tick. The exception is next_run_after — it's the
-- *current* schedule, so we always write the runner's authoritative value
-- (NULL = run anytime).
--
-- Returns the number of rows updated, used by the runner for an info log.
create or replace function public.update_firm_run_states(
  p_updates jsonb
)
returns int
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_count int;
begin
  with input as (
    select
      (elem->>'id')::uuid as id,
      (elem->>'consecutive_errors')::int as consecutive_errors,
      case
        when elem->>'next_run_after' is null then null
        when elem->>'next_run_after' = '' then null
        else (elem->>'next_run_after')::timestamptz
      end as next_run_after,
      case
        when elem->>'last_error_at' is null then null
        when elem->>'last_error_at' = '' then null
        else (elem->>'last_error_at')::timestamptz
      end as last_error_at,
      case
        when elem->>'last_success_at' is null then null
        when elem->>'last_success_at' = '' then null
        else (elem->>'last_success_at')::timestamptz
      end as last_success_at
    from jsonb_array_elements(p_updates) as elem
  )
  update public.firms f
  set
    consecutive_errors = i.consecutive_errors,
    next_run_after = i.next_run_after,
    last_error_at = coalesce(i.last_error_at, f.last_error_at),
    last_success_at = coalesce(i.last_success_at, f.last_success_at)
  from input i
  where f.id = i.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

comment on function public.update_firm_run_states(jsonb) is
  'Bulk-update firms.{consecutive_errors,next_run_after,last_error_at,last_success_at} '
  'in one round-trip. Called by the shared poll-runner after every firm batch.';
