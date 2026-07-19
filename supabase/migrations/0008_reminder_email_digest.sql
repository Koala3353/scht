alter table public.reminder_preferences
  add column if not exists digest_window_days integer not null default 3
  check (digest_window_days in (1, 3, 7, 14));

comment on column public.reminder_preferences.digest_window_days is 'How many upcoming days are included in the Apps Script email timeline.';
