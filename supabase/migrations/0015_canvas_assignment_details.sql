create table if not exists public.canvas_assignment_details (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  canvas_html text not null check (char_length(canvas_html) <= 250000),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists canvas_assignment_details_user_id_idx on public.canvas_assignment_details (user_id);

create trigger canvas_assignment_details_set_updated_at
before update on public.canvas_assignment_details
for each row execute function public.set_updated_at();

alter table public.canvas_assignment_details enable row level security;

create policy "users manage own canvas assignment details"
on public.canvas_assignment_details
for all
using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());
