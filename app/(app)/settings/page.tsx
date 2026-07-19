import { PageHeader } from "@/components/workspace/page-header";
import { AiVaultPanel } from "@/components/settings/ai-vault-panel";
import { AcademicScalePanel } from "@/components/settings/academic-scale-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ReminderPanel } from "@/components/settings/reminder-panel";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ integration?: string }>
}) {
  const params = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: preference }, { data: tasks }, { data: profile }] =
    await Promise.all([
      supabase
        .from("reminder_preferences")
        .select("timezone, quiet_start, quiet_end, enabled, digest_window_days, digest_enabled, digest_time")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .eq("user_id", user.id)
        .is("completed_at", null)
        .not("due_at", "is", null)
        .order("due_at")
        .limit(10),
      supabase
        .from("profiles")
        .select("academic_scale")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  return (
    <main className="pb-8">
      <div className="max-w-3xl">
        <PageHeader
          eyebrow="Workspace settings"
          title="Make Scht work your way."
        >
          Manage the few connections and preferences that shape your workspace.
          Each service remains separate, transparent, and under your control.
        </PageHeader>
      </div>
      <div className="mt-8 max-w-6xl">
        <SettingsNavigation />
        <div className="mt-8 space-y-10">
          {params.integration === "google-connected" && (
            <p className="rounded-xl border border-teal/20 bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal" role="status">
              Google connected. Select Sync now to import your Calendar events and unread Gmail items.
            </p>
          )}
          {params.integration === "google-error" && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
              Google could not connect. Confirm your Google test-user access, Google provider credentials, and the Supabase sign-in callback, then try again.
            </p>
          )}
          <IntegrationsPanel />
          <AiVaultPanel />
          <AcademicScalePanel
            academicScale={profile?.academic_scale === "gpa" ? "gpa" : "qpi"}
          />
          <ReminderPanel preference={preference} tasks={tasks ?? []} />
        </div>
      </div>
    </main>
  );
}
