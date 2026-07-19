import { ArrowLeft } from "lucide-react";
import { AdminControls } from "@/components/admin/admin-controls";
import { InviteOverview } from "@/components/admin/invite-overview";
import { MetricCard } from "@/components/admin/metric-card";
import { RecentAuditLog } from "@/components/admin/recent-audit-log";
import { requireOwnerAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireOwnerAdmin();
  const supabase = await createClient();
  const [
    { count: activeUsers },
    { data: currentTerms },
    { count: syncFailures },
    { count: pendingInvites },
    { count: integrationErrors },
    { data: auditEntries },
    { data: invites },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("current_term_id")
      .not("current_term_id", "is", null),
    supabase
      .from("sync_errors")
      .select("*", { count: "exact", head: true })
      .is("resolved_at", null),
    supabase
      .from("invites")
      .select("*", { count: "exact", head: true })
      .is("accepted_at", null),
    supabase
      .from("integration_connections")
      .select("*", { count: "exact", head: true })
      .eq("status", "error"),
    supabase
      .from("admin_audit_logs")
      .select("id, action, target_table, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invites")
      .select("id, email, role, accepted_at, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name")
      .limit(200),
  ]);

  const termIds = [
    ...new Set(
      (currentTerms ?? []).flatMap((profile) =>
        profile.current_term_id ? [profile.current_term_id] : [],
      ),
    ),
  ];
  const { count: currentTermTasks } =
    termIds.length > 0
      ? await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .in("term_id", termIds)
      : { count: 0 };

  return (
    <main className="mx-auto max-w-6xl p-4 pb-10 sm:p-8">
      <a
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-teal transition hover:bg-teal/5 focus-visible:outline-teal"
        href="/today"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Return to workspace
      </a>
      <div className="mt-5 max-w-3xl">
        <p className="text-xs font-extrabold tracking-[.14em] text-teal">
          OWNER ADMIN
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
          A calm view of workspace operations.
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-700">
          Manage access, understand operational health, and complete privacy
          requests. Student workspace content stays out of this view.
        </p>
      </div>

      <section
        aria-label="Workspace health metrics"
        className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <MetricCard
          label="Active users"
          value={activeUsers ?? 0}
          description="Profiles with account access"
        />
        <MetricCard
          label="Current-term tasks"
          value={currentTermTasks ?? 0}
          description="Tasks across selected terms"
        />
        <MetricCard
          label="Sync failures"
          value={syncFailures ?? 0}
          description="Unresolved task synchronization errors"
        />
        <MetricCard
          label="Connection errors"
          value={integrationErrors ?? 0}
          description="Google or Canvas connections needing attention"
        />
        <MetricCard
          label="Pending invites"
          value={pendingInvites ?? 0}
          description="Accounts awaiting their first sign-in"
        />
      </section>

      <AdminControls profiles={profiles ?? []} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <InviteOverview invites={invites ?? []} />
        <RecentAuditLog entries={auditEntries ?? []} />
      </div>
    </main>
  );
}
