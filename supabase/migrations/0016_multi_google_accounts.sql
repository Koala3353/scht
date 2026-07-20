-- A Scht workspace can link more than one Google identity. Canvas remains a
-- single connection because its personal token is institution-specific.
alter table public.integration_connections
  add column if not exists account_key text not null default 'legacy',
  add column if not exists account_email text;

alter table public.integration_connections
  drop constraint if exists integration_connections_user_id_provider_key;

create unique index if not exists integration_connections_user_provider_account_key
  on public.integration_connections (user_id, provider, account_key);

create index if not exists integration_connections_user_provider_idx
  on public.integration_connections (user_id, provider);

alter table public.integration_connections
  add constraint integration_connections_account_key_check
  check (char_length(btrim(account_key)) between 1 and 320) not valid;

alter table public.integration_connections
  validate constraint integration_connections_account_key_check;

alter table public.integration_connections
  add constraint integration_connections_account_email_check
  check (account_email is null or char_length(btrim(account_email)) between 3 and 320) not valid;

alter table public.integration_connections
  validate constraint integration_connections_account_email_check;

-- Existing integrations used raw provider IDs. Namespace them with their
-- durable connection ID once so a second Google account cannot collide.
update public.calendar_events event
set source_id = connection.id::text || ':' || event.source_id
from public.integration_connections connection
where connection.user_id = event.user_id
  and connection.provider = 'google'
  and event.provider = 'google_calendar';

update public.tasks task
set source_id = connection.id::text || ':' || task.source_id
from public.integration_connections connection
where connection.user_id = task.user_id
  and connection.provider = 'google'
  and task.source = 'gmail'
  and task.source_id is not null;
