-- Schedule the Tier-1 daily digest. Fires at 06:00 UTC — which is 07:00
-- BST in summer and 06:00 GMT in winter. We accept the 1h DST shift rather
-- than running two cron entries gated by a row-existence check.
--
-- The poll-daily-digest function is idempotent on digest_date (unique
-- constraint), so any manual or accidental re-fire on the same London-local
-- date is a cheap no-op.

select cron.schedule(
  'poll-daily-digest',
  '0 6 * * *',
  $$select public._invoke_poller('poll-daily-digest');$$
);
