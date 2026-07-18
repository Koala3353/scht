create extension if not exists pgcrypto;

create type public.profile_role as enum ('member', 'owner_admin');
create type public.academic_term_name as enum (
  'Intersession',
  'First Semester',
  'Second Semester'
);
create type public.task_kind as enum ('school', 'work', 'personal');
create type public.task_priority as enum ('low', 'normal', 'high');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'member',
  display_name text,
  avatar_url text,
  current_term_id uuid,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'owner_admin'
  );
$$;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored unique,
  role public.profile_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (email = btrim(email)),
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

create unique index academic_terms_user_starts_on_key
  on public.academic_terms (user_id, starts_on);

alter table public.profiles
  add constraint profiles_current_term_id_fkey
  foreign key (current_term_id) references public.academic_terms (id) on delete set null;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 1 and 32),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index subjects_user_term_code_key
  on public.subjects (user_id, term_id, lower(code));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid references public.academic_terms (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  kind public.task_kind not null,
  due_at timestamptz,
  priority public.task_priority not null default 'normal',
  weight_percent numeric(5, 2) check (weight_percent between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index tasks_user_term_due_at_idx
  on public.tasks (user_id, term_id, due_at nulls last);
create index tasks_user_completed_at_idx on public.tasks (user_id, completed_at);

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  course_code text not null check (char_length(btrim(course_code)) between 1 and 32),
  course_title text,
  units numeric(5, 2) not null check (units >= 0),
  category text,
  required boolean not null default true,
  prerequisite_override boolean not null default false,
  import_source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index curriculum_items_user_term_idx
  on public.curriculum_items (user_id, term_id);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  target_table text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index admin_audit_logs_actor_created_at_idx
  on public.admin_audit_logs (actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger academic_terms_set_updated_at
before update on public.academic_terms
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger curriculum_items_set_updated_at
before update on public.curriculum_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_owner_admin() then
    raise exception 'Only an owner admin can change profile roles';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
before update of role on public.profiles
for each row execute function public.prevent_profile_role_change();

create or replace function public.validate_current_term_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_term_id is not null and not exists (
    select 1 from public.academic_terms
    where id = new.current_term_id and user_id = new.id
  ) then
    raise exception 'A current term must belong to its profile';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_current_term_owner
before insert or update of current_term_id on public.profiles
for each row execute function public.validate_current_term_owner();

create or replace function public.validate_scoped_reference_owners()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referenced_subject_term_id uuid;
begin
  if new.term_id is not null and not exists (
    select 1
    from public.academic_terms
    where id = new.term_id and user_id = new.user_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Term reference must belong to the same profile';
  end if;

  if tg_table_name = 'subjects' then
    return new;
  end if;

  if new.subject_id is not null then
    select term_id
    into referenced_subject_term_id
    from public.subjects
    where id = new.subject_id and user_id = new.user_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Subject reference must belong to the same profile';
    end if;

    if new.term_id is not null
      and new.term_id is distinct from referenced_subject_term_id then
      raise exception using
        errcode = '23514',
        message = 'Subject reference must belong to the selected term';
    end if;
  end if;

  return new;
end;
$$;

create trigger subjects_validate_term_owner
before insert or update of user_id, term_id on public.subjects
for each row execute function public.validate_scoped_reference_owners();

create trigger tasks_validate_reference_owners
before insert or update of user_id, term_id, subject_id on public.tasks
for each row execute function public.validate_scoped_reference_owners();

create trigger curriculum_items_validate_reference_owners
before insert or update of user_id, term_id, subject_id on public.curriculum_items
for each row execute function public.validate_scoped_reference_owners();


create or replace function public.audit_owner_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_task_id uuid;
  changed_task_user_id uuid;
begin
  if public.is_owner_admin() then
    if tg_op = 'DELETE' then
      changed_task_id := old.id;
      changed_task_user_id := old.user_id;
    else
      changed_task_id := new.id;
      changed_task_user_id := new.user_id;
    end if;

    insert into public.admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (
      auth.uid(),
      tg_op,
      'tasks',
      changed_task_id,
      jsonb_build_object('user_id', changed_task_user_id)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger tasks_audit_owner_change
after insert or update or delete on public.tasks
for each row execute function public.audit_owner_task_change();

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.academic_terms enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "users view own profile" on public.profiles
for select using (auth.uid() = id or public.is_owner_admin());

create policy "users update own profile" on public.profiles
for update using (auth.uid() = id or public.is_owner_admin())
with check (auth.uid() = id or public.is_owner_admin());

create policy "owners manage invites" on public.invites
for all using (public.is_owner_admin())
with check (public.is_owner_admin());

create policy "users view own invite" on public.invites
for select using (lower(coalesce(auth.jwt() ->> 'email', '')) = normalized_email);

-- Invite rows stay private; these narrowly-scoped functions expose only eligibility
-- and accept an invite for the authenticated account with the matching email.
create or replace function public.has_available_invite(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invites
    where normalized_email = lower(btrim(candidate_email))
      and accepted_at is null
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

create or replace function public.accept_invite_for_current_user()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
begin
  select lower(email) into current_email from auth.users where id = auth.uid();
  if current_email is null then return false; end if;

  update public.invites
  set accepted_by = auth.uid(), accepted_at = timezone('utc', now())
  where normalized_email = current_email
    and accepted_at is null
    and (expires_at is null or expires_at > timezone('utc', now()));
  return found;
end;
$$;

grant execute on function public.has_available_invite(text) to anon, authenticated;
grant execute on function public.accept_invite_for_current_user() to authenticated;

create policy "users manage own academic terms" on public.academic_terms
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());

create policy "users manage own subjects" on public.subjects
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());

create policy "users manage own tasks" on public.tasks
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());

create policy "users manage own curriculum items" on public.curriculum_items
for all using (auth.uid() = user_id or public.is_owner_admin())
with check (auth.uid() = user_id or public.is_owner_admin());

create policy "owners view audit logs" on public.admin_audit_logs
for select using (public.is_owner_admin());

create policy "owners insert audit logs" on public.admin_audit_logs
for insert with check (public.is_owner_admin() and actor_id = auth.uid());
