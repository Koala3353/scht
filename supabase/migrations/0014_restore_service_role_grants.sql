-- Restore the server-only role's database privileges after the compact-schema
-- reset. It remains server-only and bypasses RLS; browser clients still use
-- the publishable key and owner-scoped policies.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
