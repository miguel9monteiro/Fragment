-- Prisma Tracker initial schema
-- Tables: firms, jobs, documents, applications, alert_preferences
-- RLS: documents/applications/alert_preferences owner-only;
-- firms/jobs readable by any authenticated user.

set check_function_bodies = off;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type ats_type as enum (
  'workday',
  'avature',
  'smartrecruiters',
  'greenhouse',
  'lever',
  'custom_html'
);

create type role_category as enum (
  'investment_banking',
  'sales_trading',
  'asset_management',
  'private_equity',
  'hedge_fund',
  'private_credit',
  'wealth_management',
  'research',
  'risk',
  'quant',
  'other'
);

create type programme_type as enum (
  'spring_week',
  'summer_internship',
  'off_cycle_internship',
  'industrial_placement',
  'graduate',
  'experienced',
  'unknown'
);

create type application_status as enum (
  'saved',
  'started',
  'submitted',
  'online_assessment',
  'video_interview',
  'first_round',
  'assessment_centre',
  'final_round',
  'offer',
  'rejected',
  'withdrawn'
);

create type document_kind as enum ('cv', 'cover_letter');

-- ============================================================================
-- FIRMS
-- ============================================================================

create table firms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  ats ats_type not null,
  ats_config jsonb not null default '{}'::jsonb,
  logo_url text,
  careers_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index firms_active_idx on firms (active) where active = true;
create index firms_ats_idx on firms (ats);

-- ============================================================================
-- JOBS
-- ============================================================================

create table jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  external_id text not null,
  title text not null,
  location text,
  apply_url text not null,
  category role_category not null default 'other',
  programme programme_type not null default 'unknown',
  raw jsonb,
  posted_at timestamptz,
  detected_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_firm_external_unique unique (firm_id, external_id)
);

create index jobs_detected_at_desc_idx on jobs (detected_at desc);
create index jobs_open_idx on jobs (firm_id) where closed_at is null;
create index jobs_category_idx on jobs (category);
create index jobs_programme_idx on jobs (programme);

-- ============================================================================
-- DOCUMENTS (user CVs and cover letters)
-- ============================================================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind document_kind not null,
  label text not null,
  storage_path text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_kind_idx on documents (user_id, kind);

-- One default per kind per user.
create unique index documents_one_default_per_kind on documents (user_id, kind)
  where is_default = true;

-- ============================================================================
-- APPLICATIONS
-- ============================================================================

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  status application_status not null default 'saved',
  cv_document_id uuid references documents(id) on delete set null,
  cover_letter_document_id uuid references documents(id) on delete set null,
  notes text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_user_job_unique unique (user_id, job_id)
);

create index applications_user_status_idx on applications (user_id, status);
create index applications_user_updated_idx on applications (user_id, updated_at desc);

-- ============================================================================
-- ALERT PREFERENCES
-- ============================================================================

create table alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  categories role_category[] not null default array[]::role_category[],
  programmes programme_type[] not null default array[]::programme_type[],
  firm_ids uuid[] not null default array[]::uuid[],
  uk_only boolean not null default true,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  push_subscription jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at TRIGGERS
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger firms_set_updated_at before update on firms
  for each row execute function set_updated_at();
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();
create trigger documents_set_updated_at before update on documents
  for each row execute function set_updated_at();
create trigger applications_set_updated_at before update on applications
  for each row execute function set_updated_at();
create trigger alert_preferences_set_updated_at before update on alert_preferences
  for each row execute function set_updated_at();

-- ============================================================================
-- ALERT FAN-OUT TRIGGER (stub for Phase 1)
-- ============================================================================
-- Wired now so the contract exists. Body is a no-op log; Phase 2 will replace
-- it with a pg_net call into a fan-out Edge Function that posts to each
-- subscribed user's Web Push endpoint.

create or replace function notify_new_job()
returns trigger
language plpgsql
as $$
begin
  raise log 'prisma_tracker.new_job firm_id=% external_id=% title=%',
    new.firm_id, new.external_id, new.title;
  return new;
end;
$$;

create trigger jobs_notify_new
  after insert on jobs
  for each row execute function notify_new_job();

-- ============================================================================
-- RLS
-- ============================================================================

alter table firms enable row level security;
alter table jobs enable row level security;
alter table documents enable row level security;
alter table applications enable row level security;
alter table alert_preferences enable row level security;

-- firms: readable by any authenticated user; no client writes.
create policy firms_select_authenticated
  on firms for select
  to authenticated
  using (true);

-- jobs: readable by any authenticated user; no client writes.
create policy jobs_select_authenticated
  on jobs for select
  to authenticated
  using (true);

-- documents: owner-only.
create policy documents_select_own
  on documents for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy documents_insert_own
  on documents for insert
  to authenticated
  with check (user_id = (select auth.uid()));
create policy documents_update_own
  on documents for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy documents_delete_own
  on documents for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- applications: owner-only.
create policy applications_select_own
  on applications for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy applications_insert_own
  on applications for insert
  to authenticated
  with check (user_id = (select auth.uid()));
create policy applications_update_own
  on applications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy applications_delete_own
  on applications for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- alert_preferences: owner-only.
create policy alert_preferences_select_own
  on alert_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy alert_preferences_insert_own
  on alert_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));
create policy alert_preferences_update_own
  on alert_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy alert_preferences_delete_own
  on alert_preferences for delete
  to authenticated
  using (user_id = (select auth.uid()));
