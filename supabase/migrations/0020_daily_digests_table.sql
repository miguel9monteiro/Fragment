-- Tier-1 daily digest. One row per day captures the structured JSON summary
-- + pre-rendered text/HTML used by the push channels (email, Discord). Even
-- when no push channel is configured the row still lands here, so the user
-- can `select * from daily_digests order by digest_date desc limit 7` to
-- read the last week's activity from any SQL client.
--
-- Idempotency: unique(digest_date). The poll-daily-digest function uses
-- INSERT ... ON CONFLICT (digest_date) DO NOTHING, so a re-run on the same
-- day is a no-op at the row level. Cron is scheduled at 06:00 UTC (a single
-- daily tick) so this is mostly defence-in-depth against manual retries.

create table public.daily_digests (
  id bigserial primary key,
  -- The London-local date this digest summarises. Set to date_trunc('day',
  -- now() at time zone 'Europe/London')::date by the generator.
  digest_date date not null,
  generated_at timestamptz not null default now(),
  -- Structured payload (counts, top roles, fleet health, open alerts). The
  -- generator code is the source of truth for the shape; storing as jsonb
  -- lets the future /admin UI query without re-rendering.
  summary jsonb not null,
  -- Pre-rendered plain text for email body / Discord post. ~2-4 KB typical.
  rendered_text text,
  -- Channels that successfully sent (e.g. ['email', 'discord']). Empty
  -- array means the digest landed in DB only.
  sent_via text[] not null default array[]::text[]
);

create unique index daily_digests_date_idx on public.daily_digests (digest_date);

-- For the future /admin UI to list "last N digests".
create index daily_digests_generated_at_idx
  on public.daily_digests (generated_at desc);

alter table public.daily_digests enable row level security;

comment on table public.daily_digests is
  'Daily roll-up of ingest activity, fleet health, and top new roles. '
  'Written by poll-daily-digest at 06:00 UTC, idempotent on digest_date. '
  'Read by email/Discord sinks at write time and by the future /admin UI.';
