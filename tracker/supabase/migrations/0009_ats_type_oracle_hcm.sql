-- Extend ats_type enum with oracle_hcm so we can seed firms whose careers run
-- on Oracle HCM Cloud Recruiting Candidate Experience (e.g. JPMorgan at
-- jpmc.fa.oraclecloud.com). 'smartrecruiters' was already in the enum from
-- the initial schema and only needed a config parser, not an enum extension.
--
-- Postgres requires `add value` to run outside a transaction block; Supabase
-- migrations each run in their own transaction, so this file does only the
-- enum addition. Any firm INSERTs that reference the new value go in a
-- separate later migration so they observe the committed enum.

alter type ats_type add value if not exists 'oracle_hcm';
