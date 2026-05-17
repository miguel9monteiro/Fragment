-- Phase 1 seed: 12 firms covering bulge bracket banks + large AMs.
--
-- ats_config shape for workday: { host, tenant, site, note? }.
-- The poller hits POST https://{host}/wday/cxs/{tenant}/{site}/jobs
--
-- Verification status (2026-05-16): each config below was probed against the
-- live Workday CXS endpoint and confirmed to return HTTP 200 with non-empty
-- jobPostings. Firms that have migrated off Workday are seeded with active=false
-- and a `note` recording the ATS they moved to, so future ATS adapters
-- (Avature, Taleo, Eightfold, Oracle HCM) know where to look.
--
-- Workday gotcha: tenant slugs are case-sensitive. e.g. `barclays` works,
-- `Barclays` returns HTTP 502. Most tenants in this dataset are lowercase.

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  -- ============================================================================
  -- Verified Workday endpoints (active)
  -- ============================================================================
  (
    'morgan-stanley',
    'Morgan Stanley',
    'workday',
    'https://www.morganstanley.com/people/careers',
    jsonb_build_object(
      'host', 'ms.wd5.myworkdayjobs.com',
      'tenant', 'ms',
      'site', 'External'
    ),
    true
  ),
  (
    'blackrock',
    'BlackRock',
    'workday',
    'https://careers.blackrock.com/',
    jsonb_build_object(
      'host', 'blackrock.wd1.myworkdayjobs.com',
      'tenant', 'blackrock',
      'site', 'BlackRock_Professional',
      'note', 'Professional/lateral hires. Campus is on a separate Taleo site (blackrock.tal.net) -- needs Taleo adapter for intern/grad coverage.'
    ),
    true
  ),
  (
    'barclays',
    'Barclays',
    'workday',
    'https://search.jobs.barclays/',
    jsonb_build_object(
      'host', 'barclays.wd3.myworkdayjobs.com',
      'tenant', 'barclays',
      'site', 'External_Career_Site_Barclays'
    ),
    true
  ),
  (
    'bank-of-america',
    'Bank of America',
    'workday',
    'https://careers.bankofamerica.com/',
    jsonb_build_object(
      'host', 'ghr.wd1.myworkdayjobs.com',
      'tenant', 'ghr',
      'site', 'Lateral-US',
      'note', 'Tenant `ghr` (Global Human Resources). Campus hiring is on a separate Taleo site (bankcampuscareers.tal.net).'
    ),
    true
  ),
  (
    'deutsche-bank',
    'Deutsche Bank',
    'workday',
    'https://careers.db.com/',
    jsonb_build_object(
      'host', 'db.wd3.myworkdayjobs.com',
      'tenant', 'db',
      'site', 'DBWebsite'
    ),
    true
  ),
  (
    'wellington-management',
    'Wellington Management',
    'workday',
    'https://careers.wellington.com/',
    jsonb_build_object(
      'host', 'wellington.wd5.myworkdayjobs.com',
      'tenant', 'wellington',
      'site', 'External'
    ),
    true
  ),

  -- ============================================================================
  -- Migrated off Workday (active=false until the relevant ATS adapter exists).
  -- Recorded here so we know the universe of firms we want to cover, and so
  -- that the future Avature / Taleo / Eightfold / Oracle HCM pollers have a
  -- target list to start from.
  -- ============================================================================
  (
    'goldman-sachs',
    'Goldman Sachs',
    'workday',
    'https://higher.gs.com/',
    jsonb_build_object('note', 'migrated_to_taleo: goldmansachs.tal.net (plus Avature recruiting360.avature.net for events). Reactivate when Taleo adapter ships.'),
    false
  ),
  (
    'jpmorgan',
    'JPMorgan',
    'oracle_hcm',
    'https://careers.jpmorgan.com/',
    jsonb_build_object(
      'host', 'jpmc.fa.oraclecloud.com',
      'siteNumber', 'CX_1001',
      'selectedLocationsFacets', jsonb_build_array('300000057005324'),
      'note', 'Oracle Fusion Cloud HCM. selectedLocationsFacets=[London GeographyId] narrows ~7.4k global reqs to ~500 UK reqs (server caps page at 25 regardless of limit, so global scan blows the pg_net budget). Add Edinburgh (300000057008376) or other UK GeographyIds when ops coverage matters.'
    ),
    true
  ),
  (
    'citi',
    'Citi',
    'workday',
    'https://jobs.citi.com/',
    jsonb_build_object('note', 'migrated_to_eightfold: citi.eightfold.ai. Reactivate when Eightfold adapter ships.'),
    false
  ),
  (
    'hsbc',
    'HSBC',
    'workday',
    'https://www.hsbc.com/careers',
    jsonb_build_object('note', 'migrated_to_avature: mycareer.hsbc.com. Reactivate when Avature adapter ships.'),
    false
  ),
  (
    'ubs',
    'UBS',
    'workday',
    'https://www.ubs.com/global/en/careers.html',
    jsonb_build_object('note', 'migrated_to_taleo: jobs.ubs.com/TGnewUI. Reactivate when Taleo adapter ships.'),
    false
  ),
  (
    'macquarie',
    'Macquarie',
    'workday',
    'https://www.macquarie.com/au/en/about/careers.html',
    jsonb_build_object('note', 'migrated_to_avature: recruitment.macquarie.com. Reactivate when Avature adapter ships. (Do not confuse with mq.wd3.myworkdayjobs.com which is Macquarie University, a different entity.)'),
    false
  ),

  -- ============================================================================
  -- Greenhouse (boards-api.greenhouse.io/v1/boards/{boardToken}/jobs)
  -- ============================================================================
  (
    'flow-traders',
    'Flow Traders',
    'greenhouse',
    'https://www.flowtraders.com/careers',
    jsonb_build_object('boardToken', 'flowtraders'),
    true
  ),
  (
    'alphasights',
    'AlphaSights',
    'greenhouse',
    'https://www.alphasights.com/careers',
    jsonb_build_object('boardToken', 'alphasights'),
    true
  ),
  (
    'chicago-trading-company',
    'Chicago Trading Company',
    'greenhouse',
    'https://www.chicagotrading.com/careers',
    jsonb_build_object('boardToken', 'chicagotrading'),
    true
  ),

  -- ============================================================================
  -- Lever (api.lever.co/v0/postings/{companySlug}?mode=json)
  -- Note: a small subset of tenants (e.g. SEB) live on api.eu.lever.co instead.
  -- For those, add region: 'eu' to ats_config.
  -- ============================================================================
  (
    'compass-lexecon',
    'Compass Lexecon',
    'lever',
    'https://www.compasslexecon.com/careers',
    jsonb_build_object('companySlug', 'compasslexecon'),
    true
  ),
  (
    'harrison-street',
    'Harrison Street',
    'lever',
    'https://www.harrisonst.com/careers',
    jsonb_build_object('companySlug', 'harrisonst'),
    true
  ),
  (
    'wintermute',
    'Wintermute',
    'lever',
    'https://www.wintermute.com/careers',
    jsonb_build_object('companySlug', 'wintermute-trading'),
    true
  ),
  (
    'raine-group',
    'Raine Group',
    'lever',
    'https://raine.com/careers',
    jsonb_build_object('companySlug', 'raine'),
    true
  ),

  -- ============================================================================
  -- Workable (apply.workable.com/api/v1/widget/accounts/{slug})
  -- ============================================================================
  (
    'davy',
    'Davy',
    'workable',
    'https://www.davy.ie/about/careers.html',
    jsonb_build_object('slug', 'davy', 'note', 'Irish wealth manager. Dublin roles are filtered out by the UK matcher; UK roles surface when posted.'),
    true
  ),
  (
    'intriva-capital',
    'Intriva Capital',
    'workable',
    'https://www.intrivacapital.com/careers',
    jsonb_build_object('slug', 'intriva-capital'),
    true
  ),

  -- ============================================================================
  -- TeamTailor ({slug}.teamtailor.com/jobs.rss)
  -- The .json endpoint is empty for most tenants; RSS is the canonical feed.
  -- ============================================================================
  (
    'savills',
    'Savills',
    'teamtailor',
    'https://savillsgraduates.teamtailor.com/',
    jsonb_build_object('slug', 'savillsgraduates'),
    true
  ),
  (
    'kepler-cheuvreux',
    'Kepler Cheuvreux',
    'teamtailor',
    'https://keplercheuvreux.teamtailor.com/',
    jsonb_build_object('slug', 'keplercheuvreux', 'note', 'Mostly Paris-based; UK roles surface when London-based.'),
    true
  ),
  (
    'antin-infrastructure-partners',
    'Antin Infrastructure Partners',
    'teamtailor',
    'https://antininfrastructurepartners-1655458195.teamtailor.com/',
    jsonb_build_object('slug', 'antininfrastructurepartners-1655458195'),
    true
  ),

  -- ============================================================================
  -- SmartRecruiters (api.smartrecruiters.com/v1/companies/{companySlug}/postings)
  -- companySlug is case-sensitive; matches the identifier in jobs.smartrecruiters.com/{slug}.
  -- ============================================================================
  (
    'tp-icap',
    'TP ICAP',
    'smartrecruiters',
    'https://www.tpicap.com/tpicap/careers',
    jsonb_build_object('companySlug', 'TPICAP'),
    true
  ),

  -- ============================================================================
  -- Oracle HCM Cloud Recruiting (Candidate Experience)
  -- /hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs&expand=requisitionList
  -- siteNumber is the public CX site id baked into apply URLs (e.g. CX_1001 for JPM).
  -- ============================================================================
  -- jpmorgan row lives above in the legacy Workday block (rewritten in-place to
  -- ats='oracle_hcm') so the historical comment chain stays adjacent to the
  -- other bulge-bracket entries. No additional Oracle HCM firms seeded yet.

on conflict (slug) do update set
  name = excluded.name,
  ats = excluded.ats,
  careers_url = excluded.careers_url,
  ats_config = excluded.ats_config;
-- DELIBERATELY NOT updated on conflict:
--   active     -> operators flip this in Studio when an ATS adapter ships or
--                 when a firm is paused for triage. Re-seeding must not undo
--                 those decisions.
--   logo_url   -> hand-curated; never overwrite a manually-set logo.
