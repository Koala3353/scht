import { MetricCard } from '@/components/admin/metric-card';
import { RecentAuditLog } from '@/components/admin/recent-audit-log';
import { requireOwnerAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  await requireOwnerAdmin();
  const supabase = await createClient();
  const [{ count: activeUsers }, { data: currentTerms }, { count: syncFailures }, { count: pendingInvites }, { data: auditEntries }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('current_term_id').not('current_term_id', 'is', null),
    supabase.from('sync_errors').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('invites').select('*', { count: 'exact', head: true }).is('accepted_at', null),
    supabase.from('admin_audit_logs').select('id, action, target_table, created_at').order('created_at', { ascending: false }).limit(20),
  ]);
  const termIds = [...new Set((currentTerms ?? []).flatMap((profile) => profile.current_term_id ? [profile.current_term_id] : []))];
  const { count: currentTermTasks } = termIds.length > 0
    ? await supabase.from('tasks').select('*', { count: 'exact', head: true }).in('term_id', termIds)
    : { count: 0 };

  return <main className="mx-auto max-w-6xl p-4 sm:p-8"><p className="text-xs font-extrabold tracking-[.14em] text-teal">OWNER ADMIN</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Workspace health</h1><p className="mt-2 max-w-2xl text-slate-600">Aggregate activity and operational signals. Individual workspace content is not shown here.</p><section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Active users" value={activeUsers ?? 0} description="Profiles with account access" /><MetricCard label="Current-term tasks" value={currentTermTasks ?? 0} description="Tasks across selected terms" /><MetricCard label="Sync failures" value={syncFailures ?? 0} description="Unresolved synchronization errors" /><MetricCard label="Pending invites" value={pendingInvites ?? 0} description="Invites awaiting acceptance" /></section><div className="mt-6"><RecentAuditLog entries={auditEntries ?? []} /></div></main>;
}
