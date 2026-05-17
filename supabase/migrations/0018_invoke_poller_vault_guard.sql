-- Replace public._invoke_poller with a version that raises a persistent
-- system_alert when Vault secrets are missing, instead of silently logging
-- a NOTICE.
--
-- This is the single most painful silent failure mode we hit: when the
-- service_role_key Vault secret was missing, every cron tick was a no-op
-- for 7+ hours and the only signal was an empty UI. Now any future occurrence
-- raises a 'critical' / 'vault_missing' alert that the watchdog surfaces to
-- the operator within 15 minutes.
--
-- The function preserves the existing return type (bigint = pg_net request
-- id, or null when skipped) so cron jobs that select v_request_id keep
-- working unchanged.

create or replace function public._invoke_poller(fn text)
returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_url text;
  v_key text;
  v_missing text[];
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  v_missing := array[]::text[];
  if v_url is null then v_missing := array_append(v_missing, 'project_url'); end if;
  if v_key is null then v_missing := array_append(v_missing, 'service_role_key'); end if;

  if array_length(v_missing, 1) > 0 then
    -- Raise (or refresh) the vault_missing alert. We intentionally use a
    -- single fleet-level alert keyed on (kind='vault_missing', firm_id=null)
    -- because the entire pipeline is inert until both secrets land — there
    -- is no need to fan out one alert per fn.
    --
    -- Idempotency: the partial unique index on system_alerts
    -- (kind, coalesce(firm_id::text, '_fleet_')) WHERE resolved_at IS NULL
    -- ensures a second concurrent _invoke_poller can't double-raise. We catch
    -- the unique_violation and no-op so the raise is non-destructive. (Note:
    -- ON CONFLICT can't use a partial unique index without naming it
    -- explicitly via ON CONSTRAINT, and the index name is generated; the
    -- exception block is the simplest portable form.)
    begin
      insert into public.system_alerts (level, kind, message, detail)
      values (
        'critical',
        'vault_missing',
        'Vault secret(s) missing — pollers are inert. Run vault.create_secret(...) in Studio.',
        jsonb_build_object('missing', v_missing, 'first_seen_fn', fn)
      );
    exception when unique_violation then
      null;
    end;

    raise warning '[_invoke_poller] missing vault secret(s) % — alert raised; skipping %', v_missing, fn;
    return null;
  end if;

  -- Recovery path: once both secrets are present and we're about to fire a
  -- successful pg_net call, resolve any open vault_missing alert in the same
  -- tx so the watchdog doesn't have to detect recovery separately. This
  -- pattern (raise + resolve in-band) keeps the alert lifecycle minimal for
  -- conditions the runner can self-diagnose.
  update public.system_alerts
  set resolved_at = now()
  where kind = 'vault_missing' and resolved_at is null;

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
$function$;
