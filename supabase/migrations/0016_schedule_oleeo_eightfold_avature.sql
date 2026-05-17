-- Schedule the three new pollers on the same one-minute cadence as the
-- existing ones. The shared _invoke_poller helper from migration 0005 owns
-- the vault lookup + pg_net call; we just register more cron entries that
-- reference the new function names.
--
-- cron.schedule is idempotent on name, so re-running this migration updates
-- the schedule rather than erroring.
--
-- The schedules are no-ops until the project_url and service_role_key vault
-- secrets are present; see migration 0005 for the create_secret incantations.
--
-- Avature is HTML-scrape-heavy (one HTML response per page, multi-page per
-- firm), so we schedule it every 2 minutes instead of every 1 to keep the
-- pg_net concurrency budget comfortable when the firm count grows.

select cron.schedule('poll-eightfold', '* * * * *',   $$select public._invoke_poller('poll-eightfold');$$);
select cron.schedule('poll-oleeo',     '* * * * *',   $$select public._invoke_poller('poll-oleeo');$$);
select cron.schedule('poll-avature',   '*/2 * * * *', $$select public._invoke_poller('poll-avature');$$);
