alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists tasks_user_project_idx on public.tasks (user_id, project_id);

alter table public.reminder_preferences
  add column if not exists digest_enabled boolean not null default false,
  add column if not exists digest_time time not null default '07:00';

create table if not exists public.email_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  digest_date date not null,
  provider text not null default 'apps_script',
  idempotency_key text not null unique,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id, digest_date)
);

alter table public.email_digest_deliveries enable row level security;
create policy "users view own email digests" on public.email_digest_deliveries for select using (user_id = auth.uid() or public.is_owner_admin());
