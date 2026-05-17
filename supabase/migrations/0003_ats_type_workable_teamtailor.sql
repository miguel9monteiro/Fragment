-- Extend ats_type enum with workable and teamtailor so we can seed firms for
-- the new pollers. Postgres requires `add value` to run outside a transaction
-- block; Supabase migrations run each file in its own transaction, so we use
-- the do-block + alter pattern that committs each enum addition individually.

alter type ats_type add value if not exists 'workable';
alter type ats_type add value if not exists 'teamtailor';
