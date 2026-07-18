-- Roll out scoped-reference checks to databases that have already applied 0001.
-- Recreating the triggers also makes this safe for fresh databases where 0001
-- already contains the original version of this validator.
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

drop trigger if exists subjects_validate_term_owner on public.subjects;
create trigger subjects_validate_term_owner
before insert or update of user_id, term_id on public.subjects
for each row execute function public.validate_scoped_reference_owners();

drop trigger if exists tasks_validate_reference_owners on public.tasks;
create trigger tasks_validate_reference_owners
before insert or update of user_id, term_id, subject_id on public.tasks
for each row execute function public.validate_scoped_reference_owners();

drop trigger if exists curriculum_items_validate_reference_owners on public.curriculum_items;
create trigger curriculum_items_validate_reference_owners
before insert or update of user_id, term_id, subject_id on public.curriculum_items
for each row execute function public.validate_scoped_reference_owners();
