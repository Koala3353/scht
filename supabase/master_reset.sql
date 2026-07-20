begin;

-- MANUAL OPERATOR ACTION ONLY. Do not apply this file as a migration.
-- It preserves Supabase Auth and every non-Scht Storage bucket. Empty the
-- private `syllabi` bucket through the Storage API or Dashboard before running
-- this query; direct SQL deletes are blocked to prevent orphaned objects.
do $$
begin
  raise warning 'DESTRUCTIVE Scht reset: deleting all Scht public data. The syllabi bucket must already be empty through the Storage API or Dashboard. Supabase Auth and non-Scht Storage buckets are preserved.';
end;
$$;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'syllabi') then
    raise exception 'The syllabi bucket is not empty. Empty it through the Supabase Storage API or Dashboard, then rerun this reset.';
  end if;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "users upload own syllabi" on storage.objects;
drop policy if exists "users read own syllabi" on storage.objects;
drop policy if exists "users update own syllabi" on storage.objects;
drop policy if exists "users delete own syllabi" on storage.objects;

drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
drop table if exists private.bootstrap_owner;
create table private.bootstrap_owner (
  singleton boolean primary key default true check (singleton),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  normalized_email text generated always as (lower(btrim(email))) stored unique,
  created_at timestamptz not null default timezone('utc', now())
);
-- Replace this literal before running. It may belong to an existing Auth user.
do $$
declare
  owner_email text := 'REPLACE_WITH_OWNER_EMAIL@example.com';
begin
  if owner_email ~* '^replace_with_owner_email@' then
    raise exception 'Replace REPLACE_WITH_OWNER_EMAIL@example.com with the new owner email before running this reset.';
  end if;

  insert into private.bootstrap_owner (email)
  values (owner_email);
end;
$$;
revoke all on table private.bootstrap_owner from public, anon, authenticated;

create type public.profile_role as enum ('member', 'owner_admin');
create type public.academic_term_name as enum ('Intersession', 'First Semester', 'Second Semester');
create type public.task_kind as enum ('school', 'work', 'personal');
create type public.task_priority as enum ('low', 'normal', 'high');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'member',
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  current_term_id uuid,
  onboarding_completed_at timestamptz,
  academic_scale text not null default 'qpi' check (academic_scale in ('qpi', 'gpa')),
  ai_connected_data_opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = btrim(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  normalized_email text generated always as (lower(btrim(email))) stored unique,
  role public.profile_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (accepted_at is null or accepted_by is not null)
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  academic_year integer not null check (academic_year between 2000 and 2200),
  name public.academic_term_name not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.profiles add constraint profiles_current_term_id_fkey
  foreign key (current_term_id) references public.academic_terms (id) on delete set null;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 1 and 32),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  units numeric(5, 2) not null default 3 check (units > 0 and units <= 30),
  professor_notes text check (professor_notes is null or char_length(professor_notes) <= 10000),
  course_links jsonb not null default '[]'::jsonb check (jsonb_typeof(course_links) = 'array'),
  canvas_course_id text check (canvas_course_id is null or char_length(canvas_course_id) <= 128),
  syllabus_status text not null default 'missing' check (syllabus_status in ('missing', 'uploaded', 'needs_review', 'approved')),
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  academic_year integer not null check (academic_year between 2000 and 2200),
  term public.academic_term_name not null,
  status text not null check (char_length(btrim(status)) between 1 and 32),
  course_code text not null check (char_length(btrim(course_code)) between 1 and 32),
  course_title text check (course_title is null or char_length(btrim(course_title)) between 1 and 180),
  units numeric(5, 2) not null check (units >= 0 and units <= 30),
  category text check (category is null or char_length(btrim(category)) between 1 and 80),
  required boolean not null default true,
  prerequisite_override boolean not null default false,
  import_source text check (import_source is null or import_source in ('ips', 'manual')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid references public.academic_terms (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  kind public.task_kind not null,
  due_at timestamptz,
  priority public.task_priority not null default 'normal',
  weight_percent numeric(5, 2) check (weight_percent between 0 and 100),
  notes text check (notes is null or char_length(notes) <= 20000),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  effort_minutes integer check (effort_minutes is null or effort_minutes between 1 and 1440),
  source text not null default 'manual' check (source in ('manual', 'google_calendar', 'gmail', 'canvas', 'ai', 'demo', 'sync')),
  source_id text check (source_id is null or char_length(source_id) <= 512),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.canvas_assignment_details (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  canvas_html text not null check (char_length(canvas_html) <= 250000),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index canvas_assignment_details_user_id_idx on public.canvas_assignment_details (user_id);

create table public.syllabi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'),
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 200000),
  candidate_weights jsonb not null default '[]'::jsonb check (jsonb_typeof(candidate_weights) = 'array'),
  approved_weights jsonb check (approved_weights is null or jsonb_typeof(approved_weights) = 'array'),
  validation_state text not null default 'pending' check (validation_state in ('pending', 'needs_review', 'approved')),
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz
);

create table public.grade_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  weight_percent numeric(5, 2) not null check (weight_percent between 0 and 100),
  source_syllabus_id uuid references public.syllabi (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  category_id uuid references public.grade_categories (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  score numeric not null check (score >= 0),
  possible_score numeric not null check (possible_score > 0),
  assessed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'manual')),
  source_id text not null check (char_length(source_id) between 1 and 512),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean not null default false,
  event_url text check (event_url is null or char_length(event_url) <= 2048),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  unique (user_id, provider, source_id)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'canvas')),
  account_key text not null default 'legacy' check (char_length(btrim(account_key)) between 1 and 320),
  account_email text check (account_email is null or char_length(btrim(account_email)) between 3 and 320),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  encrypted_credentials bytea,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  last_synced_at timestamptz,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider, account_key)
);

create table public.encrypted_ai_vaults (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ciphertext bytea not null,
  salt bytea not null,
  iv bytea not null,
  updated_at timestamptz not null default timezone('utc', now()),
  check (octet_length(ciphertext) > 0 and octet_length(salt) > 0 and octet_length(iv) > 0)
);

create table public.reminder_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  quiet_start time,
  quiet_end time,
  enabled boolean not null default true,
  digest_window_days integer not null default 3 check (digest_window_days in (1, 3, 7, 14)),
  digest_enabled boolean not null default false,
  digest_time time not null default '07:00',
  digest_frequency text not null default 'daily' check (digest_frequency in ('daily', 'weekly')),
  digest_weekday smallint not null default 1 check (digest_weekday between 0 and 6),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 20),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 128),
  deferred_reason text check (deferred_reason is null or char_length(deferred_reason) <= 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminder_queue (id) on delete cascade,
  provider text not null check (provider in ('apps_script')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 128),
  delivered_at timestamptz,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.email_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  digest_date date not null,
  provider text not null default 'apps_script' check (provider in ('apps_script')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 128),
  delivered_at timestamptz,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, digest_date)
);

create table public.sync_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'tasks' check (source in ('tasks', 'google', 'canvas', 'calendar', 'gmail')),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_table text not null check (char_length(target_table) between 1 and 80),
  target_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index academic_terms_user_starts_on_key on public.academic_terms (user_id, starts_on);
create index subjects_user_term_idx on public.subjects (user_id, term_id);
create unique index subjects_user_term_code_key on public.subjects (user_id, term_id, lower(code));
create index curriculum_items_user_term_idx on public.curriculum_items (user_id, term_id);
create unique index curriculum_items_import_identity_key on public.curriculum_items (user_id, academic_year, term, course_code);
create index projects_user_created_at_idx on public.projects (user_id, created_at);
create index tasks_user_due_at_idx on public.tasks (user_id, due_at nulls last);
create index tasks_user_term_due_at_idx on public.tasks (user_id, term_id, due_at nulls last);
create index tasks_user_completed_at_idx on public.tasks (user_id, completed_at);
create index tasks_user_updated_at_idx on public.tasks (user_id, updated_at);
create index tasks_user_project_idx on public.tasks (user_id, project_id);
-- NULL source IDs remain distinct, while provider identities support the
-- non-partial ON CONFLICT target used by Gmail and Canvas imports.
create unique index tasks_user_source_source_id_key on public.tasks (user_id, source, source_id);
create index syllabi_user_subject_created_at_idx on public.syllabi (user_id, subject_id, created_at desc);
create index grade_categories_user_subject_idx on public.grade_categories (user_id, subject_id);
create index assessment_results_user_subject_idx on public.assessment_results (user_id, subject_id);
create index calendar_events_user_starts_at_idx on public.calendar_events (user_id, starts_at);
create index integration_connections_user_provider_idx on public.integration_connections (user_id, provider);
create index reminder_queue_user_status_send_at_idx on public.reminder_queue (user_id, status, send_at);
create index reminder_queue_pending_send_at_idx on public.reminder_queue (send_at) where status = 'pending';
create index reminder_deliveries_reminder_id_idx on public.reminder_deliveries (reminder_id);
create index email_digest_deliveries_user_date_idx on public.email_digest_deliveries (user_id, digest_date);
create index sync_errors_user_unresolved_idx on public.sync_errors (user_id, created_at desc) where resolved_at is null;
create index admin_audit_logs_actor_created_at_idx on public.admin_audit_logs (actor_id, created_at desc);

create or replace function public.is_owner_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner_admin');
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  bootstrap_owner boolean;
begin
  delete from private.bootstrap_owner
  where normalized_email = lower(btrim(coalesce(new.email, '')))
  returning true into bootstrap_owner;

  if coalesce(bootstrap_owner, false) then
    insert into public.profiles (id, role, display_name)
    values (
      new.id,
      'owner_admin'::public.profile_role,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
    ) on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- Recover the configured owner when Auth is preserved.
-- A matching account may predate this reset, so its insert trigger will not run.
do $$
declare
  existing_owner_id uuid;
  existing_owner_display_name text;
begin
  select
    existing_auth_user.id,
    coalesce(
      existing_auth_user.raw_user_meta_data ->> 'full_name',
      existing_auth_user.raw_user_meta_data ->> 'name'
    )
  into existing_owner_id, existing_owner_display_name
  from auth.users as existing_auth_user
  join private.bootstrap_owner as bootstrap_owner
    on bootstrap_owner.normalized_email = lower(btrim(existing_auth_user.email))
  limit 1;

  if existing_owner_id is not null then
    insert into public.profiles (id, role, display_name)
    values (
      existing_owner_id,
      'owner_admin'::public.profile_role,
      existing_owner_display_name
    )
    on conflict (id) do nothing;

    delete from private.bootstrap_owner
    where singleton = true;
  end if;
end;
$$;

create or replace function public.prevent_profile_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role and not public.is_owner_admin() then
    raise exception 'Only an owner admin can change profile roles';
  end if;
  return new;
end;
$$;

create or replace function public.validate_current_term_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_term_id is not null and not exists (
    select 1 from public.academic_terms where id = new.current_term_id and user_id = new.id
  ) then
    raise exception 'A current term must belong to its profile';
  end if;
  return new;
end;
$$;

create or replace function public.validate_scoped_reference_owners()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  referenced_subject_term_id uuid;
begin
  if new.term_id is not null and not exists (
    select 1 from public.academic_terms where id = new.term_id and user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'Term reference must belong to the same profile';
  end if;
  if tg_table_name = 'subjects' then return new; end if;
  if new.subject_id is not null then
    select term_id into referenced_subject_term_id from public.subjects where id = new.subject_id and user_id = new.user_id;
    if not found then raise exception using errcode = '23503', message = 'Subject reference must belong to the same profile'; end if;
    if new.term_id is not null and new.term_id is distinct from referenced_subject_term_id then
      raise exception using errcode = '23514', message = 'Subject reference must belong to the selected term';
    end if;
  end if;
  if tg_table_name = 'tasks' and new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'Project reference must belong to the same profile';
  end if;
  return new;
end;
$$;

create or replace function public.validate_subject_reference_owners()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.subjects where id = new.subject_id and user_id = new.user_id) then
    raise exception using errcode = '23503', message = 'Subject reference must belong to the same profile';
  end if;
  if tg_table_name = 'grade_categories' and new.source_syllabus_id is not null and not exists (
    select 1 from public.syllabi where id = new.source_syllabus_id and subject_id = new.subject_id and user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'Syllabus reference must belong to the selected subject';
  end if;
  if tg_table_name = 'assessment_results' and new.category_id is not null and not exists (
    select 1 from public.grade_categories where id = new.category_id and subject_id = new.subject_id and user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'Grade category reference must belong to the selected subject';
  end if;
  return new;
end;
$$;

create or replace function public.validate_reminder_task_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.tasks where id = new.task_id and user_id = new.user_id
  ) then
    raise exception using errcode = '23503', message = 'Reminder task must belong to the same profile';
  end if;
  return new;
end;
$$;

create or replace function public.audit_owner_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner_admin() then
    insert into public.admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (
      auth.uid(), tg_op, 'tasks', coalesce(new.id, old.id),
      jsonb_build_object('user_id', coalesce(new.user_id, old.user_id))
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger academic_terms_set_updated_at before update on public.academic_terms for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects for each row execute function public.set_updated_at();
create trigger curriculum_items_set_updated_at before update on public.curriculum_items for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger canvas_assignment_details_set_updated_at before update on public.canvas_assignment_details for each row execute function public.set_updated_at();
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create trigger integration_connections_set_updated_at before update on public.integration_connections for each row execute function public.set_updated_at();
create trigger encrypted_ai_vaults_set_updated_at before update on public.encrypted_ai_vaults for each row execute function public.set_updated_at();
create trigger reminder_preferences_set_updated_at before update on public.reminder_preferences for each row execute function public.set_updated_at();
create trigger profiles_prevent_role_change before update of role on public.profiles for each row execute function public.prevent_profile_role_change();
create trigger profiles_validate_current_term_owner before insert or update of current_term_id on public.profiles for each row execute function public.validate_current_term_owner();
create trigger subjects_validate_term_owner before insert or update of user_id, term_id on public.subjects for each row execute function public.validate_scoped_reference_owners();
create trigger tasks_validate_reference_owners before insert or update of user_id, term_id, subject_id, project_id on public.tasks for each row execute function public.validate_scoped_reference_owners();
create trigger curriculum_items_validate_reference_owners before insert or update of user_id, term_id, subject_id on public.curriculum_items for each row execute function public.validate_scoped_reference_owners();
create trigger syllabi_validate_subject_owner before insert or update of user_id, subject_id on public.syllabi for each row execute function public.validate_subject_reference_owners();
create trigger grade_categories_validate_subject_owner before insert or update of user_id, subject_id, source_syllabus_id on public.grade_categories for each row execute function public.validate_subject_reference_owners();
create trigger assessment_results_validate_subject_owner before insert or update of user_id, subject_id, category_id on public.assessment_results for each row execute function public.validate_subject_reference_owners();
create trigger reminder_queue_validate_task_owner before insert or update of user_id, task_id on public.reminder_queue for each row execute function public.validate_reminder_task_owner();
create trigger tasks_audit_owner_change after insert or update or delete on public.tasks for each row execute function public.audit_owner_task_change();

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.academic_terms enable row level security;
alter table public.subjects enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.tasks enable row level security;
alter table public.canvas_assignment_details enable row level security;
alter table public.projects enable row level security;
alter table public.syllabi enable row level security;
alter table public.grade_categories enable row level security;
alter table public.assessment_results enable row level security;
alter table public.calendar_events enable row level security;
alter table public.integration_connections enable row level security;
alter table public.encrypted_ai_vaults enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.reminder_queue enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.email_digest_deliveries enable row level security;
alter table public.sync_errors enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "users view own profile" on public.profiles for select using (auth.uid() = id or public.is_owner_admin());
create policy "users update own profile" on public.profiles for update using (auth.uid() = id or public.is_owner_admin()) with check (auth.uid() = id or public.is_owner_admin());
create policy "owners manage invites" on public.invites for all using (public.is_owner_admin()) with check (public.is_owner_admin());
create policy "users view own invite" on public.invites for select using (lower(coalesce(auth.jwt() ->> 'email', '')) = normalized_email);
create policy "users manage own academic terms" on public.academic_terms for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own subjects" on public.subjects for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own curriculum items" on public.curriculum_items for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own tasks" on public.tasks for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own canvas assignment details" on public.canvas_assignment_details for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own projects" on public.projects for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own syllabi" on public.syllabi for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own grade categories" on public.grade_categories for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own assessment results" on public.assessment_results for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own calendar events" on public.calendar_events for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own integration connections" on public.integration_connections for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own encrypted ai vaults" on public.encrypted_ai_vaults for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own reminder preferences" on public.reminder_preferences for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own reminder queue" on public.reminder_queue for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users view own reminder deliveries" on public.reminder_deliveries for select using (public.is_owner_admin() or exists (select 1 from public.reminder_queue where reminder_queue.id = reminder_id and reminder_queue.user_id = auth.uid()));
create policy "users view own email digest deliveries" on public.email_digest_deliveries for select using (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own sync errors" on public.sync_errors for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "owners view audit logs" on public.admin_audit_logs for select using (public.is_owner_admin());
create policy "owners insert audit logs" on public.admin_audit_logs for insert with check (public.is_owner_admin() and actor_id = auth.uid());

create or replace function public.has_available_invite(candidate_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invites
    where normalized_email = lower(btrim(candidate_email))
      and accepted_at is null
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

create or replace function public.accept_invite_for_current_user()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  current_email text;
  accepted_invite public.invites%rowtype;
begin
  select lower(email) into current_email from auth.users where id = auth.uid();
  if current_email is null then return false; end if;

  select * into accepted_invite from public.invites
  where normalized_email = current_email and accepted_at is null
    and (expires_at is null or expires_at > timezone('utc', now()))
  for update;
  if not found then return false; end if;

  insert into public.profiles (id, role)
  values (auth.uid(), accepted_invite.role)
  on conflict (id) do nothing;

  update public.invites
  set accepted_by = auth.uid(), accepted_at = timezone('utc', now())
  where id = accepted_invite.id;
  return true;
end;
$$;
grant execute on function public.has_available_invite(text) to anon, authenticated;
revoke all on function public.accept_invite_for_current_user() from public, anon;
grant execute on function public.accept_invite_for_current_user() to authenticated;

insert into storage.buckets (id, name, public)
values ('syllabi', 'syllabi', false)
on conflict (id) do update set public = excluded.public;
create policy "users upload own syllabi" on storage.objects for insert to authenticated
with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own syllabi" on storage.objects for select to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));
create policy "users update own syllabi" on storage.objects for update to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()))
with check (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));
create policy "users delete own syllabi" on storage.objects for delete to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));

-- The server-only service-role key powers owner access checks, exports,
-- integration sync, and reminder dispatch. Recreating `public` removes the
-- normal project grants, so restore them explicitly. Authenticated clients
-- receive only CRUD privileges; RLS remains the access boundary. service_role
-- remains server-only and bypasses RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

commit;
