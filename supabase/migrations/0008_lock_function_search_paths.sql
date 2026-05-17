-- Lock down search_path on every plpgsql function we own.
--
-- Supabase's database linter flags any function without an explicit
-- `set search_path = ...` as a SECURITY warning because a malicious user with
-- CREATE rights on any reachable schema can shadow built-in operators/
-- functions and hijack the function body's resolution. SECURITY DEFINER
-- functions are the worst case (privilege escalation), but plain SECURITY
-- INVOKER triggers are still flagged for completeness.
--
-- These three already-deployed functions need the fix:
--   public.set_updated_at        -- timestamp trigger used by every table
--   public.notify_new_job        -- alert trigger stub (Phase 2 will replace body)
--   public.notify_job_reopen     -- reopen trigger added in 0007

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.notify_new_job()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise log 'prisma_tracker.new_job firm_id=% external_id=% title=%',
    new.firm_id, new.external_id, new.title;
  return new;
end;
$$;

create or replace function public.notify_job_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.detected_at := now();
  raise log 'prisma_tracker.job_reopened firm_id=% external_id=% title=%',
    new.firm_id, new.external_id, new.title;
  return new;
end;
$$;

-- Cover the highest-traffic FK on applications. Without this, every
-- DELETE / UPDATE on jobs.id incurs a seq scan over applications. The other
-- two FK warnings (cv_document_id, cover_letter_document_id) are sparse,
-- low-cardinality, and not worth the index write cost yet.
create index if not exists applications_job_id_idx
  on public.applications (job_id);
