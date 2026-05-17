-- Seed firms covered by the new SmartRecruiters and Oracle HCM adapters.
-- This migration is idempotent and intentionally separate from supabase/seed.sql
-- because seed.sql is only re-applied on `supabase db reset` (local dev),
-- whereas remote/production databases need their firms added via migrations.
--
-- Firms added/updated here:
--   - TP ICAP  (slug: tp-icap)   -> SmartRecruiters (companySlug=TPICAP)
--   - JPMorgan (slug: jpmorgan)  -> Oracle HCM Cloud Recruiting
--                                  (host=jpmc.fa.oraclecloud.com, siteNumber=CX_1001)
--
-- The existing `jpmorgan` row in seed.sql was a Workday placeholder with
-- active=false and a note pointing at Oracle HCM ("Reactivate when Oracle HCM
-- adapter ships."). We now reactivate it under the new adapter.

-- New firm: TP ICAP on SmartRecruiters.
insert into firms (slug, name, ats, careers_url, ats_config, active) values
  (
    'tp-icap',
    'TP ICAP',
    'smartrecruiters',
    'https://www.tpicap.com/tpicap/careers',
    jsonb_build_object('companySlug', 'TPICAP'),
    true
  )
on conflict (slug) do nothing;

-- Reactivate JPMorgan under Oracle HCM. UPDATE (not INSERT) because the
-- jpmorgan slug already exists from the initial Phase 1 seed. We intentionally
-- only flip from the Workday placeholder; a hand-edited row (e.g. an operator
-- pinning ats_config in Studio for triage) is left alone.
update firms
set
  ats = 'oracle_hcm',
  careers_url = 'https://careers.jpmorgan.com/',
  ats_config = jsonb_build_object(
    'host', 'jpmc.fa.oraclecloud.com',
    'siteNumber', 'CX_1001',
    'selectedLocationsFacets', jsonb_build_array('300000057005324'),
    'note', 'Oracle Fusion Cloud HCM. selectedLocationsFacets=[London GeographyId] narrows ~7.4k global reqs to ~500 UK reqs (server caps page at 25 regardless of limit, so global scan blows the pg_net budget). Add Edinburgh (300000057008376) or other UK GeographyIds when ops coverage matters.'
  ),
  active = true
where slug = 'jpmorgan' and ats = 'workday' and active = false;
