alter table public.reminder_preferences
  add column if not exists digest_frequency text not null default 'daily'
    check (digest_frequency in ('daily', 'weekly')),
  add column if not exists digest_weekday smallint not null default 1
    check (digest_weekday between 0 and 6);

comment on column public.reminder_preferences.digest_frequency is 'Whether the optional email update is sent each day or once per week.';
comment on column public.reminder_preferences.digest_weekday is 'Weekly email day using 0=Sunday through 6=Saturday.';
