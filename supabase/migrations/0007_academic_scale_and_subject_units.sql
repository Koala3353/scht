alter table public.profiles
  add column if not exists academic_scale text not null default 'qpi'
  check (academic_scale in ('qpi', 'gpa'));

alter table public.subjects
  add column if not exists units numeric(5,2) not null default 3
  check (units > 0 and units <= 30);
