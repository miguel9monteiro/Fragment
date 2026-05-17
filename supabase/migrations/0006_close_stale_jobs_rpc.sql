-- Single-round-trip close-stale for the poller runner. Previously the runner
-- did SELECT open external_ids then UPDATE WHERE external_id IN (diff), which
-- is two round-trips per firm and ships a potentially large id list over the
-- wire. This collapses it into one server-side statement.
--
-- p_seen is the set of external_ids the poller saw this run. Anything open
-- for the firm and NOT in that set gets closed -- subject to the sanity
-- guards below, which exist because a transient ATS failure (CDN miss,
-- parse regression, tenant maintenance window) used to manifest as
-- close_stale_jobs(firm_id, '{}') -> "close every open job for the firm".
-- One bad 60s cycle was enough to wipe a firm's entire catalog.

create or replace function public.close_stale_jobs(
  p_firm_id uuid,
  p_seen text[]
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_open   bigint;
  v_stale  bigint;
  v_closed bigint;
  -- Tunables. Conservative defaults: prefer under-closing one cycle over
  -- nuking the catalog. Live data reconciles on the next tick.
  c_min_open_for_empty_seen constant int := 5;  -- if open > 5 and seen={}, skip
  c_max_close_pct           constant int := 50; -- never close >50% of open in one run
begin
  p_seen := coalesce(p_seen, '{}'::text[]);

  select count(*) into v_open
    from public.jobs
   where firm_id = p_firm_id and closed_at is null;
  if v_open = 0 then return 0; end if;

  select count(*) into v_stale
    from public.jobs
   where firm_id   = p_firm_id
     and closed_at is null
     and not (external_id = any(p_seen));

  -- Guard 1: zero ids seen with a non-trivial open universe is almost always
  -- a transient fetcher failure, not a legitimate "every role at the firm
  -- closed in the last 60 seconds". Skip and warn.
  if cardinality(p_seen) = 0 and v_open > c_min_open_for_empty_seen then
    raise warning '[close_stale_jobs] firm=% open=% seen=0 -- treating as transient, skipping close',
      p_firm_id, v_open;
    return 0;
  end if;

  -- Guard 2: hard cap on the proportion of open jobs we will auto-close in
  -- a single run. Protects against half-broken parsers and CDN-layer issues
  -- that return partial pages.
  if v_stale * 100 > v_open * c_max_close_pct then
    raise warning '[close_stale_jobs] firm=% would_close=%/% (>% pct) -- skipping close, treating as suspect',
      p_firm_id, v_stale, v_open, c_max_close_pct;
    return 0;
  end if;

  with closed as (
    update public.jobs
       set closed_at = now()
     where firm_id   = p_firm_id
       and closed_at is null
       and not (external_id = any(p_seen))
    returning 1
  )
  select count(*) into v_closed from closed;
  return v_closed;
end;
$$;

revoke all on function public.close_stale_jobs(uuid, text[]) from public, anon, authenticated;
grant execute on function public.close_stale_jobs(uuid, text[]) to service_role;
