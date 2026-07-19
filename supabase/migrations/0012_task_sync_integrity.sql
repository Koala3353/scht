-- Conflict-safe task updates compare the authenticated user's last canonical row.
create index if not exists tasks_user_updated_at_idx
  on public.tasks (user_id, updated_at);
