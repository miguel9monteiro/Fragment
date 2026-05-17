-- Hardening migration for the catalog-destroyer cluster and adjacent gaps:
--
--   1. Reopen semantics: when close_stale_jobs marks a row closed and a later
--      poll cycle re-detects the same external_id, the upsert now writes
--      closed_at = null (see supabase/functions/_shared/poll-runner.ts). We
--      need a BEFORE UPDATE trigger that re-stamps detected_at on the
--      closed_at NOT NULL -> NULL transition, so the role surfaces as freshly
--      detected and the "5 minute" promise survives reopens. The original
--      after-insert alert trigger does not fire on this path because
--      INSERT ... ON CONFLICT DO UPDATE fires the UPDATE trigger, not the
--      INSERT trigger, when the row already exists.
--
--   2. apply_url scheme constraint: apply_url is rendered into <a href> on
--      /jobs and is sourced from arbitrary external ATS payloads. Without a
--      scheme guard, a malformed payload (javascript:, data:, etc.) becomes
--      stored XSS on every catalog viewer. Enforce http(s) at the DB layer so
--      the frontend defense (URL parser at render time) has a partner.
--
--   3. Open-jobs index that actually serves the /jobs list query. The
--      existing jobs_open_idx is keyed on firm_id only; the list query is
--      ORDER BY detected_at DESC WHERE closed_at IS NULL. Add a partial
--      index on detected_at so the page renders in O(page) at scale.

-- ============================================================================
-- 1. Reopen trigger
-- ============================================================================

create or replace function public.notify_job_reopen()
returns trigger
language plpgsql
as $$
begin
  -- Re-stamp detected_at so the role surfaces in the "just now" bucket on
  -- /jobs, even though this is technically an UPDATE of an existing row.
  new.detected_at := now();
  raise log 'prisma_tracker.job_reopened firm_id=% external_id=% title=%',
    new.firm_id, new.external_id, new.title;
  return new;
end;
$$;

drop trigger if exists jobs_notify_reopen on public.jobs;
create trigger jobs_notify_reopen
  before update of closed_at on public.jobs
  for each row
  when (old.closed_at is not null and new.closed_at is null)
  execute function public.notify_job_reopen();

-- ============================================================================
-- 2. apply_url scheme guard
-- ============================================================================
-- Backfill defensively: any pre-existing row with a non-http(s) apply_url
-- gets closed rather than blocking the migration. In practice this set
-- should be empty in Phase 1, but the close keeps the constraint installable.

update public.jobs
   set closed_at = coalesce(closed_at, now())
 where apply_url !~* '^https?://';

alter table public.jobs
  drop constraint if exists jobs_apply_url_http_only;
alter table public.jobs
  add constraint jobs_apply_url_http_only
  check (apply_url ~* '^https?://');

-- ============================================================================
-- 3. Open-jobs ordering index
-- ============================================================================

create index if not exists jobs_open_detected_at_idx
  on public.jobs (detected_at desc)
  where closed_at is null;
