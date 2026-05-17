-- Mass seed of M&A firms across all supported ATS families. Idempotent: new
-- rows go via INSERT...ON CONFLICT (slug) DO NOTHING; the five inactive
-- firms (HSBC, Macquarie, Goldman Sachs, Citi, Bank of America) are
-- reactivated via explicit UPDATEs that match the *prior* config so a
-- hand-edited row in Studio (e.g. operator triage) isn't clobbered.
--
-- Firms intentionally NOT seeded here (no public ATS feed or requires an
-- adapter we have not built):
--   - Robey Warshaw       (acquired by Evercore Jul 2025; brand folded)
--   - Liberty Corp. Fin.  (39-person; no public board)
--   - Oaklins UK          (UK member has no exposed feed)
--   - Centerview          (custom .aspx, ~no UK postings)
--   - Jamieson CF         (no public feed)
--   - UBS                 (Taleo TGnewUI — adapter not built this pass)
--   - Stifel UK           (iCIMS — adapter not built)
--   - KPMG UK             (custom HTML at /Vacancies/{id} — not built)
--   - EY                  (SuccessFactors — adapter not built)
--   - Deloitte UK         (Avature on vanity domain — held; see note in code)
--   - Scotiabank          (Radancy/TalentBrew — not built)
--   - Crédit Agricole CIB (Talentsoft — not built)
--   - Mediobanca          (Inrecruiting — not built)
--   - Mizuho International (3 custom hosts — not built)
--   - Clearwater Intl     (static marketing site — not built)
--   - Cavendish, Panmure Liberum (unidentified ATSes — not built)
--   - GP Bullhound        (Recruitee — not built)
--   - Arma Partners       (Trakstar Hire — not built)
--   - Nomura experienced  (SuccessFactors — not built)
--
-- "*-campus" slug suffix: every Workday tenant we add has at least two sites
-- (experienced + campus). Rather than extend the Workday config with a
-- sites[] array, we model each site as its own firm row so the seed stays
-- legible and so a per-site failure doesn't poison the experienced flow.

-- =========================================================================
-- 1. EXISTING ROW FIXES
-- =========================================================================

-- Bank of America: the existing row pointed at the US-only Lateral-US site.
-- Lateral-EMEA is the canonical site for UK / Continental Europe / MEA roles.
update firms
set
  ats_config = jsonb_build_object(
    'host', 'ghr.wd1.myworkdayjobs.com',
    'tenant', 'ghr',
    'site', 'Lateral-EMEA',
    'note', 'EMEA experienced hires. Sibling sites: Lateral-US (US), campus-* (sites tbd).'
  ),
  active = true
where slug = 'bank-of-america';

-- =========================================================================
-- 2. WORKDAY (existing adapter)
-- =========================================================================
-- All UK-active. Multi-site tenants get one row per site (suffix `-campus`).

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  -- Rothschild & Co — two sites under one tenant.
  ('rothschild-and-co', 'Rothschild & Co', 'workday',
   'https://www.rothschildandco.com/en/careers/',
   jsonb_build_object('host', 'rothschildandco.wd3.myworkdayjobs.com', 'tenant', 'rothschildandco', 'site', 'RothschildAndCo_Lateral',
                      'note', 'Experienced/lateral hires. Campus on rothschild-and-co-campus.'),
   true),
  ('rothschild-and-co-campus', 'Rothschild & Co (Campus)', 'workday',
   'https://www.rothschildandco.com/en/careers/',
   jsonb_build_object('host', 'rothschildandco.wd3.myworkdayjobs.com', 'tenant', 'rothschildandco', 'site', 'RothschildAndCo_Interns',
                      'note', 'Internships, off-cycle, summer analyst.'),
   true),

  -- Moelis & Co
  ('moelis', 'Moelis & Co', 'workday',
   'https://www.moelis.com/careers/',
   jsonb_build_object('host', 'moelis.wd1.myworkdayjobs.com', 'tenant', 'moelis', 'site', 'Experienced-Hires',
                      'note', 'Hyphenated site name is part of the path. Campus on moelis-campus.'),
   true),
  ('moelis-campus', 'Moelis & Co (Campus)', 'workday',
   'https://www.moelis.com/careers/',
   jsonb_build_object('host', 'moelis.wd1.myworkdayjobs.com', 'tenant', 'moelis', 'site', 'University-Hires',
                      'note', 'Summer analyst + off-cycle.'),
   true),

  -- PJT Partners
  ('pjt-partners', 'PJT Partners', 'workday',
   'https://pjtpartners.com/careers/',
   jsonb_build_object('host', 'pjtpartners.wd1.myworkdayjobs.com', 'tenant', 'pjtpartners', 'site', 'Careers',
                      'note', 'Experienced/lateral hires.'),
   true),
  ('pjt-partners-campus', 'PJT Partners (Campus)', 'workday',
   'https://pjtpartners.com/careers/',
   jsonb_build_object('host', 'pjtpartners.wd1.myworkdayjobs.com', 'tenant', 'pjtpartners', 'site', 'Students',
                      'note', 'Spring Insight / Summer Analyst / Off-Cycle.'),
   true),

  -- Houlihan Lokey
  ('houlihan-lokey', 'Houlihan Lokey', 'workday',
   'https://hl.com/careers/',
   jsonb_build_object('host', 'hl.wd1.myworkdayjobs.com', 'tenant', 'hl', 'site', 'Lateral',
                      'note', 'Lateral/experienced. Campus separate.'),
   true),
  ('houlihan-lokey-campus', 'Houlihan Lokey (Campus)', 'workday',
   'https://hl.com/careers/',
   jsonb_build_object('host', 'hl.wd1.myworkdayjobs.com', 'tenant', 'hl', 'site', 'Campus',
                      'note', 'Summer Analyst + Internship programmes.'),
   true),

  -- Alantra UK (single site)
  ('alantra', 'Alantra', 'workday',
   'https://alantra.wd3.myworkdayjobs.com/Alantra',
   jsonb_build_object('host', 'alantra.wd3.myworkdayjobs.com', 'tenant', 'alantra', 'site', 'Alantra',
                      'note', 'UK M&A boutique. Single site, clean Workday.'),
   true),

  -- PwC — global feed (volume risk; UK filter does the work downstream).
  ('pwc', 'PwC', 'workday',
   'https://www.pwc.co.uk/careers/experienced-careers.html',
   jsonb_build_object('host', 'pwc.wd3.myworkdayjobs.com', 'tenant', 'pwc', 'site', 'Global_Experienced_Careers',
                      'note', 'Global feed. UK filter is critical. Campus site (Global_Campus_Careers) deferred.'),
   true),

  -- Grant Thornton UK — UK-only tenant.
  ('grant-thornton', 'Grant Thornton UK', 'workday',
   'https://www.grantthornton.co.uk/careers/',
   jsonb_build_object('host', 'ukgrantt.wd3.myworkdayjobs.com', 'tenant', 'ukgrantt', 'site', 'CareersGrantThornton',
                      'note', 'UK-only Workday tenant. All roles UK.'),
   true),
  ('grant-thornton-campus', 'Grant Thornton UK (Campus)', 'workday',
   'https://www.grantthornton.co.uk/careers/',
   jsonb_build_object('host', 'ukgrantt.wd3.myworkdayjobs.com', 'tenant', 'ukgrantt', 'site', 'TraineeCareersGrantThornton',
                      'note', 'Trainee / apprentice / grad programme.'),
   true),

  -- BDO UK — UK-only tenant.
  ('bdo', 'BDO UK', 'workday',
   'https://careers.bdo.co.uk/',
   jsonb_build_object('host', 'bdouk.wd3.myworkdayjobs.com', 'tenant', 'bdouk', 'site', 'BDO_Careers',
                      'note', 'UK-only Workday tenant. NOT bdo.wd3 (that''s BDO Canada).'),
   true),
  ('bdo-campus', 'BDO UK (Early Careers)', 'workday',
   'https://careers.bdo.co.uk/',
   jsonb_build_object('host', 'bdouk.wd3.myworkdayjobs.com', 'tenant', 'bdouk', 'site', 'BDO_Early_in_Career',
                      'note', 'Trainee / school leaver / industrial placement.'),
   true),

  -- RBC Capital Markets UK
  ('rbc-capital-markets', 'RBC Capital Markets UK', 'workday',
   'https://jobs.rbc.com/ca/en/cmuk',
   jsonb_build_object('host', 'rbc.wd3.myworkdayjobs.com', 'tenant', 'rbc', 'site', 'RBCGLOBAL1',
                      'note', 'Global experienced; UK filter via locationsText "United Kingdom..." substring.'),
   true),
  ('rbc-capital-markets-campus', 'RBC Capital Markets UK (Campus)', 'workday',
   'https://jobs.rbc.com/ca/en/cmuk',
   jsonb_build_object('host', 'rbc.wd3.myworkdayjobs.com', 'tenant', 'rbc', 'site', 'RBCEARLYTALENT1',
                      'note', 'Global campus; UK summer analyst Markets/IB roles post here.'),
   true),

  -- Raymond James UK
  ('raymond-james', 'Raymond James UK', 'workday',
   'https://raymondjames.wd1.myworkdayjobs.com/RaymondJamesCareers',
   jsonb_build_object('host', 'raymondjames.wd1.myworkdayjobs.com', 'tenant', 'raymondjames', 'site', 'RaymondJamesCareers',
                      'note', 'Single global site; UK volume low.'),
   true),
  ('raymond-james-campus', 'Raymond James UK (Early Careers)', 'workday',
   'https://raymondjames.wd1.myworkdayjobs.com/RaymondJamesEarlyCareers',
   jsonb_build_object('host', 'raymondjames.wd1.myworkdayjobs.com', 'tenant', 'raymondjames', 'site', 'RaymondJamesEarlyCareers',
                      'note', 'Intern / grad programmes.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 3. GREENHOUSE (existing adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('lincoln-international', 'Lincoln International', 'greenhouse',
   'https://www.lincolninternational.com/careers-and-culture/careers/',
   jsonb_build_object('boardToken', 'lincolninternational',
                      'note', 'Standard Greenhouse board. UK volume uncertain; firm has London office.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 4. WORKABLE (existing adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('dc-advisory', 'DC Advisory', 'workable',
   'https://www.dcadvisory.com/careers/',
   jsonb_build_object('slug', 'dcadvisory',
                      'note', 'NOT rolled into Daiwa parent (uk.daiwacm.com). Summer intern recruitment uses BeApplied separately and will NOT appear on Workable.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 5. TEAMTAILOR (existing adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('peel-hunt', 'Peel Hunt', 'teamtailor',
   'https://careersat.peelhunt.com/jobs',
   jsonb_build_object('slug', 'peelhunt',
                      'note', 'London-only firm. Vanity domain careersat.peelhunt.com fronts the standard TeamTailor RSS at peelhunt.teamtailor.com/jobs.rss.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 6. SMARTRECRUITERS (existing adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('societe-generale', 'Société Générale (SG CIB)', 'smartrecruiters',
   'https://careers.societegenerale.com/en/search',
   jsonb_build_object('companySlug', 'SocieteGenerale4',
                      'note', 'Trailing "4" is the actual company id, not a typo. UK CIB roles post here.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 7. ORACLE HCM (existing adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('jefferies', 'Jefferies', 'oracle_hcm',
   'https://www.jefferies.com/careers/apply-now/',
   jsonb_build_object('host', 'hdid.fa.us2.oraclecloud.com', 'siteNumber', 'CX_1',
                      'note', 'Experienced/lateral hires. Campus runs on jefferies.tal.net (see jefferies-campus row).'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 8. OLEEO (new adapter — *.tal.net RSS feeds)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  -- Goldman Sachs — confirmed appcentre 1 / brand 2; boards 1, 2, 6 (events + main + ?).
  ('goldman-sachs-oleeo', 'Goldman Sachs', 'oleeo',
   'https://goldmansachs.tal.net/',
   jsonb_build_object('host', 'goldmansachs.tal.net', 'appcentreId', '1', 'brandId', '2', 'boardIds', jsonb_build_array(1, 2, 6),
                      'note', 'Reactivation under Oleeo (previously inactive Workday row; goldman-sachs slug remains for legacy reference).'),
   true),

  -- Lazard — brand 4 confirmed; boards 2 (Students) + 3 (Professionals).
  ('lazard', 'Lazard', 'oleeo',
   'https://www.lazard.com/careers/',
   jsonb_build_object('host', 'lazard-careers.tal.net', 'appcentreId', '1', 'brandId', '4', 'boardIds', jsonb_build_array(2, 3),
                      'note', 'Single Avature-style appcentre. London is largest non-US office.'),
   true),

  -- Evercore — brand 6 confirmed; boards 2 (Students) + 3 (Experienced).
  ('evercore', 'Evercore', 'oleeo',
   'https://evercorecareersemea.com/',
   jsonb_build_object('host', 'evercore.tal.net', 'appcentreId', '1', 'brandId', '6', 'boardIds', jsonb_build_array(2, 3),
                      'note', 'EMEA heavy. London is biggest office outside NYC.'),
   true),

  -- Jefferies campus — brand 4; boards 1 + 2 (Events + Campus).
  ('jefferies-campus', 'Jefferies (Campus)', 'oleeo',
   'https://jefferies.tal.net/',
   jsonb_build_object('host', 'jefferies.tal.net', 'appcentreId', '1', 'brandId', '4', 'boardIds', jsonb_build_array(1, 2),
                      'note', 'EMEA grad / SA programmes. Lateral hires use Oracle HCM (jefferies row).'),
   true),

  -- Perella Weinberg — non-numeric appcentre "pwpext"; brand 4.
  ('perella-weinberg', 'Perella Weinberg Partners', 'oleeo',
   'https://www.pwpartners.com/careers/',
   jsonb_build_object('host', 'pwpcareers.tal.net', 'appcentreId', 'pwpext', 'brandId', '4', 'boardIds', jsonb_build_array(1, 2, 3),
                      'note', 'Healthy London inventory: M&A, FIG, restructuring. appcentre is alphanumeric not integer.'),
   true),

  -- BNP Paribas CIB — brand 2 = CIB per research notes.
  ('bnp-paribas', 'BNP Paribas (CIB)', 'oleeo',
   'https://careers.cib.bnpparibas/',
   jsonb_build_object('host', 'bnpparibas.tal.net', 'appcentreId', '1', 'brandId', '2', 'boardIds', jsonb_build_array(1, 2),
                      'note', 'Brand 2 = CIB; brand 4 = early careers (not seeded yet); brand 0 = group-wide.'),
   true),

  -- Nomura campus — boardId 1 confirmed in research; appcentre/brand best guess.
  ('nomura-campus', 'Nomura (Campus)', 'oleeo',
   'https://nomuracampus.tal.net/candidate/',
   jsonb_build_object('host', 'nomuracampus.tal.net', 'appcentreId', '1', 'brandId', '1', 'boardIds', jsonb_build_array(1, 2),
                      'note', 'Campus / EMEA grad. Experienced hires are on careers.nomura.com (SuccessFactors, not seeded).'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 9. EIGHTFOLD (new adapter)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  ('citi-eightfold', 'Citi', 'eightfold',
   'https://citi.eightfold.ai/careers',
   jsonb_build_object('host', 'citi.eightfold.ai', 'domain', 'citi.com',
                      'note', 'Reactivation under Eightfold (previously inactive Workday row; citi slug remains for legacy reference). Server-side Country=United Kingdom filter applies.'),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 10. AVATURE (new adapter — HTML scrape)
-- =========================================================================

insert into firms (slug, name, ats, careers_url, ats_config, active) values
  -- HSBC — confirmed param names from live fetch (pipelineRecordsPerPage / pipelineOffset, PipelineDetail).
  -- WARNING: HSBC is migrating to portal.careers.hsbc.com (likely Eightfold). Revisit if mycareer.hsbc.com goes 404.
  ('hsbc-avature', 'HSBC', 'avature',
   'https://mycareer.hsbc.com/en_GB/external/SearchJobs',
   jsonb_build_object(
     'host', 'mycareer.hsbc.com',
     'searchPath', '/en_GB/external/SearchJobs',
     'recordsParam', 'pipelineRecordsPerPage',
     'offsetParam', 'pipelineOffset',
     'detailPathToken', 'PipelineDetail',
     'pageSize', 50,
     'note', 'Reactivation under Avature. May be sunset for portal.careers.hsbc.com (Eightfold) — revisit if 404s appear.'
   ),
   true),

  -- Macquarie — confirmed param names from live fetch (jobRecordsPerPage / jobOffset, JobDetail).
  ('macquarie-avature', 'Macquarie', 'avature',
   'https://recruitment.macquarie.com/en_US/careers/SearchJobs',
   jsonb_build_object(
     'host', 'recruitment.macquarie.com',
     'searchPath', '/en_US/careers/SearchJobs',
     'recordsParam', 'jobRecordsPerPage',
     'offsetParam', 'jobOffset',
     'detailPathToken', 'JobDetail',
     'pageSize', 50,
     'note', 'Reactivation under Avature.'
   ),
   true),

  -- William Blair — `.avature.net` confirmed; param names assumed (Macquarie convention).
  ('william-blair', 'William Blair', 'avature',
   'https://williamblair.avature.net/careers',
   jsonb_build_object(
     'host', 'williamblair.avature.net',
     'searchPath', '/careers/SearchJobs',
     'recordsParam', 'jobRecordsPerPage',
     'offsetParam', 'jobOffset',
     'detailPathToken', 'JobDetail',
     'pageSize', 50,
     'note', 'Param names assumed from Macquarie convention; verify on first run.'
   ),
   true)
on conflict (slug) do nothing;

-- =========================================================================
-- 11. REACTIVATION UPDATES (point legacy slugs at the new adapter rows)
-- =========================================================================
-- The 5 inactive bulge-bracket rows from migration 0001 stay inactive; their
-- new homes are the *-avature, *-oleeo, *-eightfold slugs added above. The
-- note column flags the redirect so future operators don't reactivate the
-- stale Workday/Taleo config.

update firms set
  ats_config = ats_config || jsonb_build_object('note', 'Superseded by goldman-sachs-oleeo (Oleeo / .tal.net). Keep inactive.')
where slug = 'goldman-sachs';

update firms set
  ats_config = ats_config || jsonb_build_object('note', 'Superseded by hsbc-avature (Avature / mycareer.hsbc.com). Keep inactive. Pending HSBC migration to portal.careers.hsbc.com (likely Eightfold).')
where slug = 'hsbc';

update firms set
  ats_config = ats_config || jsonb_build_object('note', 'Superseded by macquarie-avature (Avature / recruitment.macquarie.com). Keep inactive.')
where slug = 'macquarie';

update firms set
  ats_config = ats_config || jsonb_build_object('note', 'Superseded by citi-eightfold (Eightfold / citi.eightfold.ai). Keep inactive.')
where slug = 'citi';

-- UBS stays as-is: Taleo TGnewUI adapter is on the backlog, not built this pass.
update firms set
  ats_config = ats_config || jsonb_build_object('note', 'Still pending: Taleo TGnewUI adapter (CSRF + JSESSIONID + multi-siteId). Keep inactive.')
where slug = 'ubs';
