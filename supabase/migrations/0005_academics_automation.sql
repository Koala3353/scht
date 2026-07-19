alter table public.subjects add column if not exists professor_notes text;
alter table public.subjects add column if not exists course_links jsonb not null default '[]'::jsonb;
alter table public.subjects add column if not exists canvas_course_id text;
alter table public.subjects add column if not exists syllabus_status text not null default 'missing';
alter table public.subjects add column if not exists archived_at timestamptz;

create table public.syllabi (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, subject_id uuid not null references public.subjects(id) on delete cascade, storage_path text not null, extracted_text text, candidate_weights jsonb not null default '[]'::jsonb, approved_weights jsonb, validation_state text not null default 'pending', created_at timestamptz not null default timezone('utc', now()), reviewed_at timestamptz);
create table public.grade_categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, subject_id uuid not null references public.subjects(id) on delete cascade, name text not null, weight_percent numeric(5,2) not null check (weight_percent between 0 and 100), source_syllabus_id uuid references public.syllabi(id) on delete set null, approved_at timestamptz, created_at timestamptz not null default timezone('utc', now()));
create table public.assessment_results (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, subject_id uuid not null references public.subjects(id) on delete cascade, category_id uuid references public.grade_categories(id) on delete set null, title text not null, score numeric not null check (score >= 0), possible_score numeric not null check (possible_score > 0), assessed_at timestamptz, created_at timestamptz not null default timezone('utc', now()));
create table public.projects (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, name text not null, status text not null default 'active', created_at timestamptz not null default timezone('utc', now()));
create table public.notes (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, subject_id uuid references public.subjects(id) on delete set null, project_id uuid references public.projects(id) on delete set null, title text not null, body text not null default '', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()));
create table public.integration_connections (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, provider text not null, status text not null default 'disconnected', encrypted_credentials bytea, settings jsonb not null default '{}'::jsonb, last_synced_at timestamptz, error_message text, created_at timestamptz not null default timezone('utc', now()), unique(user_id, provider));
create table public.encrypted_ai_vaults (user_id uuid primary key references public.profiles(id) on delete cascade, ciphertext bytea not null, salt bytea not null, iv bytea not null, updated_at timestamptz not null default timezone('utc', now()));
create table public.ai_conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, provider text not null, messages jsonb not null default '[]'::jsonb, proposal jsonb, applied_at timestamptz, created_at timestamptz not null default timezone('utc', now()));
create table public.reminder_preferences (user_id uuid primary key references public.profiles(id) on delete cascade, timezone text not null default 'UTC', quiet_start time, quiet_end time, enabled boolean not null default true, updated_at timestamptz not null default timezone('utc', now()));
create table public.reminder_queue (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, task_id uuid references public.tasks(id) on delete cascade, send_at timestamptz not null, status text not null default 'pending', attempts integer not null default 0, idempotency_key text not null unique, deferred_reason text, created_at timestamptz not null default timezone('utc', now()));
create table public.reminder_deliveries (id uuid primary key default gen_random_uuid(), reminder_id uuid not null references public.reminder_queue(id) on delete cascade, provider text not null, idempotency_key text not null unique, delivered_at timestamptz, error_message text, created_at timestamptz not null default timezone('utc', now()));
create table public.global_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default timezone('utc', now()));
create table public.feature_flags (key text primary key, enabled boolean not null default false, updated_at timestamptz not null default timezone('utc', now()));

do $$ declare table_name text; begin
  foreach table_name in array array['syllabi','grade_categories','assessment_results','projects','notes','integration_connections','encrypted_ai_vaults','ai_conversations','reminder_preferences','reminder_queue'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "users manage own rows" on public.%I for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin())', table_name);
  end loop;
  alter table public.reminder_deliveries enable row level security;
  create policy "users view own reminder deliveries" on public.reminder_deliveries for select using (exists (select 1 from public.reminder_queue where id = reminder_id and (user_id = auth.uid() or public.is_owner_admin())));
  alter table public.global_settings enable row level security;
  create policy "owners manage global settings" on public.global_settings for all using (public.is_owner_admin()) with check (public.is_owner_admin());
  alter table public.feature_flags enable row level security;
  create policy "owners manage feature flags" on public.feature_flags for all using (public.is_owner_admin()) with check (public.is_owner_admin());
end $$;

create index reminder_queue_pending_idx on public.reminder_queue (send_at) where status = 'pending';
create index assessment_results_subject_idx on public.assessment_results (subject_id);
