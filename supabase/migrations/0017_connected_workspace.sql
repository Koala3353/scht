-- Connected task-workspace features: breakdowns, focus, provider change history,
-- and reusable notification rules. All rows remain small and user-scoped.

create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  position integer not null default 0 check (position >= 0 and position <= 10000),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  subtask_id uuid references public.task_subtasks (id) on delete set null,
  planned_minutes integer not null check (planned_minutes in (25, 50)),
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.task_change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  source text not null check (source in ('canvas', 'gmail', 'google_calendar', 'manual', 'ai', 'sync')),
  change_kind text not null check (change_kind in ('created', 'deadline_changed', 'details_changed', 'completed', 'reopened')),
  summary text not null check (char_length(summary) between 1 and 500),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('weighted_due', 'canvas_change', 'gmail_attention')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, kind)
);

create index if not exists task_subtasks_task_position_idx on public.task_subtasks (task_id, position, created_at);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
create index if not exists task_change_events_user_created_idx on public.task_change_events (user_id, created_at desc);
create index if not exists notification_rules_user_idx on public.notification_rules (user_id);

create or replace function public.validate_task_subtask_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.tasks where id = new.task_id and user_id = new.user_id) then
    raise exception using errcode = '23503', message = 'Subtask must belong to the same workspace owner';
  end if;
  return new;
end;
$$;

create or replace function public.log_task_change()
returns trigger language plpgsql set search_path = public as $$
declare
  event_kind text;
  event_summary text;
begin
  if tg_op = 'INSERT' then
    event_kind := 'created';
    event_summary := case when new.source in ('canvas', 'gmail', 'google_calendar')
      then initcap(replace(new.source, '_', ' ')) || ' added “' || new.title || '”.'
      else 'Task “' || new.title || '” was created.' end;
  elsif old.completed_at is distinct from new.completed_at then
    event_kind := case when new.completed_at is null then 'reopened' else 'completed' end;
    event_summary := case when new.completed_at is null then 'Reopened “' || new.title || '”.' else 'Completed “' || new.title || '”.' end;
  elsif old.due_at is distinct from new.due_at then
    event_kind := 'deadline_changed';
    event_summary := 'Deadline changed for “' || new.title || '”.';
  elsif old.notes is distinct from new.notes or old.title is distinct from new.title or old.links is distinct from new.links then
    event_kind := 'details_changed';
    event_summary := 'Details changed for “' || new.title || '”.';
  else
    return new;
  end if;
  insert into public.task_change_events (user_id, task_id, source, change_kind, summary)
  values (new.user_id, new.id, case when new.source in ('canvas', 'gmail', 'google_calendar', 'manual', 'ai', 'sync') then new.source else 'sync' end, event_kind, event_summary);
  return new;
end;
$$;

drop trigger if exists task_subtasks_set_updated_at on public.task_subtasks;
create trigger task_subtasks_set_updated_at before update on public.task_subtasks for each row execute function public.set_updated_at();
drop trigger if exists notification_rules_set_updated_at on public.notification_rules;
create trigger notification_rules_set_updated_at before update on public.notification_rules for each row execute function public.set_updated_at();
drop trigger if exists task_subtasks_validate_owner on public.task_subtasks;
create trigger task_subtasks_validate_owner before insert or update of user_id, task_id on public.task_subtasks for each row execute function public.validate_task_subtask_owner();
drop trigger if exists tasks_log_change on public.tasks;
create trigger tasks_log_change after insert or update on public.tasks for each row execute function public.log_task_change();

alter table public.task_subtasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.task_change_events enable row level security;
alter table public.notification_rules enable row level security;

create policy "users manage own task subtasks" on public.task_subtasks for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own focus sessions" on public.focus_sessions for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
create policy "users view own task change events" on public.task_change_events for select using (auth.uid() = user_id or public.is_owner_admin());
create policy "users manage own notification rules" on public.notification_rules for all using (auth.uid() = user_id or public.is_owner_admin()) with check (auth.uid() = user_id or public.is_owner_admin());
