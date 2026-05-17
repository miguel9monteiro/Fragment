-- Wire up automated polling. Without this, detection latency is unbounded:
-- the Edge Functions exist but nothing invokes them on a clock. Each poller
-- hits a different external host (Workday tenants, Greenhouse boards, Lever,
-- Workable, TeamTailor) so there is no shared rate-limit collision. The DB
-- cost is bounded by the runner's per-firm Promise.all.
--
-- Cadence: every 60 seconds for all pollers. With the per-firm timeout at 20s
-- inside each poller, a full cycle fits well inside the 60s window. This
-- bounds detection latency at ~p95 60-90s, comfortably inside the 5-minute
-- product promise.
--
-- Operator setup (run once via SQL editor or supabase CLI; values must NOT be
-- committed to source control):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',                'service_role_key');

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Single helper so the schedule bodies stay short and the vault lookup logic
-- is in one place. SECURITY DEFINER because vault.decrypted_secrets is
-- restricted to postgres.
--
-- search_path is intentionally locked to public + pg_temp ONLY. With `vault`
-- on the search_path of a SECURITY DEFINER function owned by postgres, any
-- unqualified resolution inside the body (an operator, a function) could
-- resolve to a vault.* symbol an attacker plants -- the textbook SECURITY
-- DEFINER footgun Supabase advisors flag. We fully-qualify every cross-schema
-- reference below (vault.*, net.*) so the lockdown is safe.
create or replace function public._invoke_poller(fn text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_url is null or v_key is null then
    raise warning '[_invoke_poller] missing vault secret project_url or service_role_key; skipping %', fn;
    return null;
  end if;

  -- timeout_milliseconds MUST be shorter than the cron interval below.
  -- Previously 60000ms (equal to the 60s cron tick), which meant an upstream
  -- ATS slowdown let two invocations overlap and self-DDoS the function.
  -- 30s leaves plenty of headroom inside the 60s window.
  select net.http_post(
    url := v_url || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public._invoke_poller(text) from public, anon, authenticated;

-- cron.schedule is idempotent on name (re-running updates the schedule).
-- Supabase pg_cron only accepts sub-minute intervals in `[1-59] seconds`
-- format; anything >= 60s must use standard cron syntax. `* * * * *` runs
-- every minute, which keeps p95 detection latency under 90s and is well
-- inside the 5-minute product promise.
select cron.schedule('poll-workday',    '* * * * *', $$select public._invoke_poller('poll-workday');$$);
select cron.schedule('poll-greenhouse', '* * * * *', $$select public._invoke_poller('poll-greenhouse');$$);
select cron.schedule('poll-lever',      '* * * * *', $$select public._invoke_poller('poll-lever');$$);
select cron.schedule('poll-workable',   '* * * * *', $$select public._invoke_poller('poll-workable');$$);
select cron.schedule('poll-teamtailor', '* * * * *', $$select public._invoke_poller('poll-teamtailor');$$);
