create table public.sync_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'tasks',
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index sync_errors_unresolved_idx on public.sync_errors (resolved_at) where resolved_at is null;

alter table public.sync_errors enable row level security;

create policy "users view own sync errors" on public.sync_errors
for select using (auth.uid() = user_id or public.is_owner_admin());

create policy "users manage own sync errors" on public.sync_errors
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());
