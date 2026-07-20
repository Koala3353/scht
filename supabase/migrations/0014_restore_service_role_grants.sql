-- Restore database privileges after the compact-schema reset. Browser clients
-- get only CRUD rights and remain bound by RLS; service_role remains server-only
-- and bypasses RLS for trusted server routes.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
