import type { ReactNode } from "react";
import { ArrowLeft, MailCheck, ShieldCheck, UsersRound } from "lucide-react";

import { AdminControls } from "@/components/admin/admin-controls";
import { DeliveryLog, type DeliveryEvent } from "@/components/admin/delivery-log";
import { InviteOverview } from "@/components/admin/invite-overview";
import { MetricCard } from "@/components/admin/metric-card";
import { OperationsCharts } from "@/components/admin/operations-charts";
import { RecentAuditLog } from "@/components/admin/recent-audit-log";
import { UserDebugger, type AdminUserSummary } from "@/components/admin/user-debugger";
import { requireOwnerAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function eventStatus(deliveredAt: string | null, errorMessage: string | null) {
  if (deliveredAt) return "sent" as const;
  return errorMessage ? "failed" as const : "pending" as const;
}

function shortDay(value: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(value);
}

export default async function AdminPage() {
  await requireOwnerAdmin({
    unauthenticatedRedirect: "/admin/sign-in?error=sign-in-required",
    unauthorizedRedirect: "/admin/sign-in?error=not-owner",
    accessCheckFailureRedirect: "/admin/sign-in?error=workspace-access-check-failed",
  });
  const supabase = await createClient();
  const [
    profilesResult,
    termsResult,
    tasksResult,
    subjectsResult,
    connectionsResult,
    syncErrorsResult,
    pendingInvitesResult,
    auditResult,
    reminderQueueResult,
    reminderDeliveriesResult,
    digestDeliveriesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, role, display_name, current_term_id, created_at"),
    supabase.from("academic_terms").select("id, user_id, academic_year, name").order("starts_on"),
    supabase.from("tasks").select("id, user_id, term_id, title, completed_at, created_at"),
    supabase.from("subjects").select("id, user_id"),
    supabase.from("integration_connections").select("user_id, provider, status, last_synced_at, error_message"),
    supabase.from("sync_errors").select("id, user_id, resolved_at").is("resolved_at", null),
    supabase.from("invites").select("id, email, role, accepted_at, expires_at, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("admin_audit_logs").select("id, action, target_table, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("reminder_queue").select("id, user_id, task_id, status, send_at, deferred_reason, created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("reminder_deliveries").select("id, reminder_id, delivered_at, error_message, created_at").order("created_at", { ascending: false }).limit(250),
    supabase.from("email_digest_deliveries").select("id, user_id, digest_date, delivered_at, error_message, created_at").order("created_at", { ascending: false }).limit(250),
  ]);

  const profiles = profilesResult.data ?? [];
  const terms = termsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const subjects = subjectsResult.data ?? [];
  const connections = connectionsResult.data ?? [];
  const unresolvedErrors = syncErrorsResult.data ?? [];
  const reminders = reminderQueueResult.data ?? [];
  const reminderDeliveries = reminderDeliveriesResult.data ?? [];
  const digestDeliveries = digestDeliveriesResult.data ?? [];

  let emailByUserId = new Map<string, string>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    emailByUserId = new Map((data.users ?? []).flatMap((user) => user.email ? [[user.id, user.email] as const] : []));
  } catch {
    // Auth emails are an optional debugging enhancement; dashboard data remains owner-scoped through RLS.
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const termById = new Map(terms.map((term) => [term.id, term]));
  const tasksByUser = new Map<string, typeof tasks>();
  const subjectsByUser = new Map<string, typeof subjects>();
  const connectionsByUser = new Map<string, typeof connections>();
  const errorsByUser = new Map<string, typeof unresolvedErrors>();
  for (const task of tasks) tasksByUser.set(task.user_id, [...(tasksByUser.get(task.user_id) ?? []), task]);
  for (const subject of subjects) subjectsByUser.set(subject.user_id, [...(subjectsByUser.get(subject.user_id) ?? []), subject]);
  for (const connection of connections) connectionsByUser.set(connection.user_id, [...(connectionsByUser.get(connection.user_id) ?? []), connection]);
  for (const error of unresolvedErrors) errorsByUser.set(error.user_id, [...(errorsByUser.get(error.user_id) ?? []), error]);

  const userLabel = (userId: string) => emailByUserId.get(userId) ?? profileById.get(userId)?.display_name ?? userId;
  const directory: AdminUserSummary[] = profiles.map((profile) => {
    const userTasks = tasksByUser.get(profile.id) ?? [];
    const userConnections = connectionsByUser.get(profile.id) ?? [];
    const currentTerm = profile.current_term_id ? termById.get(profile.current_term_id) : null;
    const connectionStatus: AdminUserSummary["connectionStatus"] = userConnections.some((connection) => connection.status === "error")
      ? "attention"
      : userConnections.some((connection) => connection.status === "connected")
        ? "healthy"
        : "not-connected";
    return {
      id: profile.id,
      email: emailByUserId.get(profile.id) ?? null,
      displayName: profile.display_name,
      role: profile.role as "member" | "owner_admin",
      currentTerm: currentTerm ? `${currentTerm.academic_year}–${currentTerm.academic_year + 1} · ${currentTerm.name}` : null,
      taskCount: userTasks.length,
      openTaskCount: userTasks.filter((task) => !task.completed_at).length,
      subjectCount: (subjectsByUser.get(profile.id) ?? []).length,
      syncErrorCount: (errorsByUser.get(profile.id) ?? []).length,
      connectionStatus,
    };
  }).sort((left, right) => (left.displayName ?? left.email ?? left.id).localeCompare(right.displayName ?? right.email ?? right.id));

  const reminderById = new Map(reminders.map((reminder) => [reminder.id, reminder]));
  const globalReminderEvents: DeliveryEvent[] = reminderDeliveries.flatMap((delivery) => {
    const reminder = reminderById.get(delivery.reminder_id);
    if (!reminder) return [];
    return [{
      id: `reminder-${delivery.id}`,
      recipient: userLabel(reminder.user_id),
      kind: "Task reminder" as const,
      status: eventStatus(delivery.delivered_at, delivery.error_message),
      occurredAt: delivery.delivered_at ?? delivery.created_at,
      detail: taskById.get(reminder.task_id ?? "")?.title ?? "Scheduled task reminder",
    }];
  });
  const deliveredReminderIds = new Set(reminderDeliveries.map((delivery) => delivery.reminder_id));
  const unresolvedReminderEvents: DeliveryEvent[] = reminders
    .filter((reminder) => !deliveredReminderIds.has(reminder.id) && (reminder.deferred_reason || reminder.status === "pending"))
    .map((reminder) => ({
      id: `queue-${reminder.id}`,
      recipient: userLabel(reminder.user_id),
      kind: "Task reminder" as const,
      status: reminder.deferred_reason ? "failed" as const : "pending" as const,
      occurredAt: reminder.send_at ?? reminder.created_at,
      detail: reminder.deferred_reason ?? taskById.get(reminder.task_id ?? "")?.title ?? "Queued task reminder",
    }));
  const digestEvents: DeliveryEvent[] = digestDeliveries.map((delivery) => ({
    id: `digest-${delivery.id}`,
    recipient: userLabel(delivery.user_id),
    kind: "Scheduled update" as const,
    status: eventStatus(delivery.delivered_at, delivery.error_message),
    occurredAt: delivery.delivered_at ?? delivery.created_at,
    detail: `Digest for ${delivery.digest_date}${delivery.error_message ? ` · ${delivery.error_message}` : ""}`,
  }));
  const deliveryEvents = [...globalReminderEvents, ...unresolvedReminderEvents, ...digestEvents]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 150);

  const now = new Date();
  const dayStarts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return date;
  });
  const activity = dayStarts.map((day) => {
    const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
    const inside = (value: string) => { const date = new Date(value); return date >= day && date < nextDay; };
    return { label: shortDay(day), tasks: tasks.filter((task) => inside(task.created_at)).length, emails: deliveryEvents.filter((event) => inside(event.occurredAt)).length };
  });
  const openTasks = tasks.filter((task) => !task.completed_at).length;
  const completedTasks = tasks.length - openTasks;
  const connectionCounts = {
    connected: connections.filter((connection) => connection.status === "connected").length,
    attention: connections.filter((connection) => connection.status === "error").length,
    disconnected: connections.filter((connection) => connection.status === "disconnected").length,
  };
  const deliveryCounts = {
    sent: deliveryEvents.filter((event) => event.status === "sent").length,
    failed: deliveryEvents.filter((event) => event.status === "failed").length,
    pending: deliveryEvents.filter((event) => event.status === "pending").length,
  };
  const currentTermTasks = tasks.filter((task) => task.term_id && profiles.some((profile) => profile.current_term_id === task.term_id)).length;
  const connectedUsers = directory.filter((user) => user.connectionStatus === "healthy").length;

  return (
    <main className="mx-auto max-w-7xl pb-10">
      <a className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-teal transition hover:bg-teal/5 focus-visible:outline-teal" href="/today"><ArrowLeft aria-hidden="true" className="size-4" />Return to workspace</a>
      <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl"><p className="text-xs font-extrabold tracking-[.14em] text-teal">OWNER OPERATIONS</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">The Scht workspace, at a glance.</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700">Monitor adoption, connection health, email delivery, and individual student workspaces without exposing provider credentials.</p></div>
        <div className="grid grid-cols-3 gap-2"><QuickStat icon={<UsersRound aria-hidden="true" className="size-4" />} label="Profiles" value={profiles.length} /><QuickStat icon={<ShieldCheck aria-hidden="true" className="size-4" />} label="Healthy" value={connectedUsers} /><QuickStat icon={<MailCheck aria-hidden="true" className="size-4" />} label="Sent" value={deliveryCounts.sent} /></div>
      </div>

      <section aria-label="Workspace health metrics" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard description="Profiles with workspace access" label="Active users" value={profiles.length} />
        <MetricCard description="Tasks linked to selected terms" label="Current-term tasks" value={currentTermTasks} />
        <MetricCard description="Tasks still waiting to be completed" label="Open tasks" value={openTasks} />
        <MetricCard description="Provider links currently healthy" label="Connected users" value={connectedUsers} />
        <MetricCard description="Unresolved Google, Canvas, or sync records" label="Sync failures" value={unresolvedErrors.length} />
        <MetricCard description="Failed or deferred delivery attempts" label="Email attention" value={deliveryCounts.failed + deliveryCounts.pending} />
        <MetricCard description="Accounts awaiting first successful sign-in" label="Pending invites" value={(pendingInvitesResult.data ?? []).filter((invite) => !invite.accepted_at).length} />
        <MetricCard description="Tasks marked complete across the workspace" label="Completed tasks" value={completedTasks} />
      </section>

      <OperationsCharts activity={activity} connections={connectionCounts} deliveries={deliveryCounts} tasks={{ open: openTasks, completed: completedTasks }} />
      <AdminControls profiles={directory} />
      <UserDebugger users={directory} />
      <DeliveryLog deliveries={deliveryEvents} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_.92fr]"><InviteOverview invites={pendingInvitesResult.data ?? []} /><RecentAuditLog entries={auditResult.data ?? []} /></div>
    </main>
  );
}

function QuickStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"><div className="flex items-center gap-1.5 text-xs font-bold text-teal">{icon}{label}</div><p className="mt-1 text-lg font-black text-slate-950">{value.toLocaleString()}</p></div>;
}
