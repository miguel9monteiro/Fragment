-- Schedule the new SmartRecruiters and Oracle HCM pollers on the same
-- one-minute cadence as the existing five. The shared _invoke_poller helper
-- defined in migration 0005 owns the vault lookup and pg_net request; we just
-- add two more cron entries that reference it by function name.
--
-- cron.schedule is idempotent on name, so re-running this migration updates
-- the schedule rather than erroring.
--
-- The schedules are no-ops until the project_url and service_role_key vault
-- secrets are present; see migration 0005 for the create_secret incantations.

select cron.schedule('poll-smartrecruiters', '* * * * *', $$select public._invoke_poller('poll-smartrecruiters');$$);
select cron.schedule('poll-oracle-hcm',      '* * * * *', $$select public._invoke_poller('poll-oracle-hcm');$$);
