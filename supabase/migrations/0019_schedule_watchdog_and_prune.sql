-- Schedule the Tier-0 observability jobs.
--
--   poll-watchdog        every 15 minutes — reads poller_runs, raises and
--                        resolves entries in system_alerts, optionally
--                        sends Resend email on state transitions.
--
--   prune-poller-runs    daily at 04:00 UTC — deletes poller_runs rows older
--                        than 30 days. Off-peak so it doesn't compete with
--                        the 1-minute poller fan-out. The prune does a
--                        single DELETE; on a 2.4M-row table the index scan
--                        plus heap deletes stay well under a minute.
--
-- The watchdog is scheduled via the same _invoke_poller helper as the
-- detection pollers, so it inherits the vault-secret discipline and the
-- pg_net request budget. The prune calls the SQL function directly because
-- it does not need a service-role round-trip through an Edge Function.
--
-- cron.schedule is idempotent on name, so re-running this migration updates
-- the schedule rather than erroring.

select cron.schedule(
  'poll-watchdog',
  '*/15 * * * *',
  $$select public._invoke_poller('poll-watchdog');$$
);

select cron.schedule(
  'prune-poller-runs',
  '0 4 * * *',
  $$select public.prune_poller_runs(30);$$
);
