-- Bring existing foundation databases up to the curriculum-import contract.
-- Fresh databases receive these columns in 0001; IF NOT EXISTS keeps this
-- migration safe for both upgrade paths.
alter table public.curriculum_items
  add column if not exists academic_year integer,
  add column if not exists term public.academic_term_name,
  add column if not exists status text;

update public.curriculum_items as item
set academic_year = academic_term.academic_year,
    term = academic_term.name,
    status = coalesce(item.status, 'Unknown')
from public.academic_terms as academic_term
where academic_term.id = item.term_id
  and (item.academic_year is null or item.term is null or item.status is null);

alter table public.curriculum_items
  alter column academic_year set not null,
  alter column term set not null,
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'curriculum_items_academic_year_check'
  ) then
    alter table public.curriculum_items
      add constraint curriculum_items_academic_year_check
      check (academic_year between 2000 and 2200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'curriculum_items_status_check'
  ) then
    alter table public.curriculum_items
      add constraint curriculum_items_status_check
      check (char_length(btrim(status)) between 1 and 32);
  end if;
end;
$$;

create unique index if not exists curriculum_items_import_identity_key
  on public.curriculum_items (user_id, academic_year, term, course_code);
