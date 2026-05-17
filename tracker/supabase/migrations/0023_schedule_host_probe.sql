-- Schedule the Tier-2B auto-recovery probe. Daily at 03:00 UTC — quiet
-- window between European overnight (no fresh roles expected) and the
-- 04:00 poller_runs prune. Probes every active=false firm with a
-- careers_url; raises firm_recovery_ready if DNS + HTTP both succeed.
--
-- The function is idempotent (system_alerts partial unique index), so
-- multiple invocations on the same day are safe — useful when re-running
-- after a config fix.

select cron.schedule(
  'poll-host-probe',
  '0 3 * * *',
  $$select public._invoke_poller('poll-host-probe');$$
);
