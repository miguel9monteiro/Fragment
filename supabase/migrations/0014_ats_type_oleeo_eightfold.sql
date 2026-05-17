-- Extend ats_type with two new ATS families unlocked by the latest research:
--
--   oleeo      -> the .tal.net hosted ATS (formerly WCN, owned by Oleeo). Used
--                 by Goldman Sachs, Lazard, Evercore, Jefferies-campus, Perella
--                 Weinberg, BNP Paribas CIB, Nomura-campus and many other tier-1
--                 banks. Exposes a public RSS 2.0 feed at
--                 /vx/lang-en-GB/mobile-0/appcentre-<n>/brand-<m>/candidate/jobboard/vacancy/<k>/feed.
--   eightfold  -> citi.eightfold.ai-style SmartApply careers. Used by Citi (and
--                 likely the new portal.careers.hsbc.com that HSBC is migrating
--                 to). Public JSON API at /api/apply/v2/jobs with clean shape.
--
-- We are intentionally NOT adding "taleo" yet — the only firm on Taleo TGnewUI
-- in the user's list is UBS, and the adapter is much harder to harden (CSRF
-- + JSESSIONID + multi-siteId), so it stays in the backlog. Similarly, iCIMS,
-- SuccessFactors, Talentsoft, Inrecruiting, Recruitee, and Trakstar are all
-- noted as "future adapters" but not added to the enum until they have an
-- implementation. Premature enum values would silently pass firms.ats CHECK
-- without a poller behind them.
--
-- Postgres requires `add value` to run outside a transaction block; Supabase
-- migrations each run in their own transaction, so this file does only the
-- enum additions. Firm seeds that reference the new values live in a later
-- migration so they observe the committed enum.

alter type ats_type add value if not exists 'oleeo';
alter type ats_type add value if not exists 'eightfold';
