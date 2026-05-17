-- Extend programme_type with explicit tenure tiers so the /jobs UI can let
-- students filter by seniority, not just by sub-vertical.
--
-- Before this migration: programme_type collapsed everything post-graduate into
-- the single bucket `experienced`, so a "Junior Investment Analyst" and a
-- "Managing Director, M&A" appeared identical to the UI. This was fine for
-- internship/grad detection (the original promise) but useless once feeds
-- started returning everything a firm has open. Splitting tenure mirrors how
-- candidates actually filter careers pages.
--
-- New values and the rough ladder they map to (banking-flavoured; same idea
-- holds in AM/PE):
--   entry_level  -> Analyst / Associate base titles, no scheme markers
--   mid_level    -> AVP / VP / Manager
--   senior       -> Director / MD / Head of / Principal / Lead / Partner /
--                   Chief / Senior <X> / Staff <X>
--
-- `experienced` is intentionally left in the enum so existing rows keep
-- their type, but classify() no longer emits it; reclassification (see
-- migration 0013) re-buckets all existing `experienced` rows into the new
-- tiers. Future code paths can drop `experienced` once the value has zero
-- occurrences.
--
-- Postgres requires `add value` to run outside a transaction block; Supabase
-- migrations each run in their own transaction, so this file does only the
-- enum additions. Reclassification of existing rows is in migration 0013 so
-- it observes the committed enum.

alter type programme_type add value if not exists 'entry_level';
alter type programme_type add value if not exists 'mid_level';
alter type programme_type add value if not exists 'senior';
