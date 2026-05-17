-- Schedule the Tier-3 coverage-guarantee jobs.
--
--   snapshot-firm-volumes    Daily at 05:00 UTC — between the host-probe
--                            (03:00) and the daily digest (06:00). Pure
--                            SQL, no Edge Function hop needed, so we call
--                            the snapshot_firm_volumes() function directly
--                            via cron.
--
--   poll-careers-scan        Weekly Saturday 02:00 UTC — the quietest
--                            point in the week globally. Fetches each
--                            firm's careers_url, hashes the ATS-vendor
--                            signal set, raises firm_careers_drift when
--                            it changes. ~60 HTTP fetches/week — well
--                            below polite-crawl limits.
--
-- cron.schedule is idempotent on name, so this migration is safe to
-- re-apply.

select cron.schedule(
  'snapshot-firm-volumes',
  '0 5 * * *',
  $$select public.snapshot_firm_volumes();$$
);

select cron.schedule(
  'poll-careers-scan',
  '0 2 * * 6',
  $$select public._invoke_poller('poll-careers-scan');$$
);
