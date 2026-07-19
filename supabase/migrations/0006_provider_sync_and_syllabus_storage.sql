alter table public.tasks add column if not exists source text not null default 'manual';
alter table public.tasks add column if not exists source_id text;
alter table public.tasks add column if not exists notes text;
alter table public.tasks add column if not exists links jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists effort_minutes integer check (effort_minutes is null or effort_minutes > 0);

create unique index if not exists tasks_user_source_source_id_key
  on public.tasks (user_id, source, source_id)
  where source_id is not null;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  source_id text not null,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean not null default false,
  event_url text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, provider, source_id)
);

alter table public.calendar_events enable row level security;
create policy "users manage own calendar events" on public.calendar_events
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());

create index if not exists calendar_events_user_starts_at_idx on public.calendar_events (user_id, starts_at);

insert into storage.buckets (id, name, public)
values ('syllabi', 'syllabi', false)
on conflict (id) do nothing;

create policy "users upload own syllabi" on storage.objects
for insert to authenticated
with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own syllabi" on storage.objects
for select to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));

create policy "users update own syllabi" on storage.objects
for update to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()))
with check (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));

create policy "users delete own syllabi" on storage.objects
for delete to authenticated
using (bucket_id = 'syllabi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner_admin()));
