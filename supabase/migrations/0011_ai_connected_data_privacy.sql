alter table public.profiles
  add column if not exists ai_connected_data_opt_in boolean not null default false;

comment on column public.profiles.ai_connected_data_opt_in is 'Explicit user consent to include data already imported from connected services in an AI request.';
