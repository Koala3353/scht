-- Provider imports use this exact conflict target with ON CONFLICT DO NOTHING.
-- PostgreSQL treats NULL values as distinct here, so manual tasks without a
-- source_id remain independently creatable.
drop index if exists public.tasks_user_source_source_id_key;

create unique index tasks_user_source_source_id_key
  on public.tasks (user_id, source, source_id);
