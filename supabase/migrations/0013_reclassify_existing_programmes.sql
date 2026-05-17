-- One-shot reclassification of every job row's `programme` column to match the
-- broadened TS classifier (supabase/functions/_shared/classify.ts) that lands
-- alongside this migration.
--
-- The CASE below mirrors that classifier's priority order verbatim, translated
-- from JS regex to Postgres POSIX ERE:
--   1. spring_week
--   2. summer_internship
--   3. industrial_placement
--   4. off_cycle_internship       (catches bare "internship" with no season)
--   5. graduate                   (catches bare "graduate" anywhere in title)
--   6. senior                     (Director / MD / Head of / Principal / Lead /
--                                  Partner / Chief / Senior <X> / Staff <X>)
--   7. mid_level                  (VP / AVP / Manager)
--   8. entry_level                (Analyst / Associate / Junior)
--   9. unknown
--
-- Idempotent: classify() is deterministic, so re-running this migration is a
-- no-op on already-correctly-classified rows. We reclassify all rows (open AND
-- closed) so the historical record is consistent if a closed role ever reopens.
--
-- Drift risk: this SQL must stay in sync with the TS classifier. Long-term,
-- the TS classifier is the source of truth — this migration only exists to
-- backfill the ~200 rows already in the DB without waiting for the next poll
-- cycle to re-upsert them.

update jobs
set programme = case
  -- 1. Spring Week
  when title ~* '\yspring\s+(week|insight|programme|program|intern(ship)?|into)\y'
    then 'spring_week'::programme_type

  -- 2. Summer Internship
  when title ~* '\ysummer\s+(analyst|associate|intern(ship)?|programme|program|insight|20\d{2})\y'
    then 'summer_internship'::programme_type

  -- 3. Industrial Placement
  when title ~* '\y(industrial\s+placement|placement\s+(year|student|programme|program)|12[\s-]?month\s+(placement|intern(ship)?)|sandwich\s+(placement|year))\y'
    then 'industrial_placement'::programme_type

  -- 4. Off-cycle Internship (incl. fallback for bare "internship")
  when title ~* '\y(off[\s-]?cycle|(winter|autumn|fall)\s+intern(ship)?|intern(ship)?)\y'
    then 'off_cycle_internship'::programme_type

  -- 5. Graduate scheme
  when title ~* '\y(graduate|grad\s+scheme|campus\s+hire|new\s+(analyst|associate)|full[\s-]?time\s+analyst|apprentice|trainee|class\s+of\s+20\d{2})\y'
    then 'graduate'::programme_type

  -- 6. Senior (must come before mid_level / entry_level)
  when title ~* '\y(managing\s+director|director|head\s+of|principal|partner|chief|md|senior|staff|lead)\y'
    then 'senior'::programme_type

  -- 7. Mid-level (VP / AVP / Manager)
  when title ~* '\y(vice\s+president|vp|assistant\s+vice\s+president|avp|manager)\y'
    then 'mid_level'::programme_type

  -- 8. Entry-level (Analyst / Associate / Junior)
  when title ~* '\y(analyst|associate|junior)\y'
    then 'entry_level'::programme_type

  else 'unknown'::programme_type
end;
