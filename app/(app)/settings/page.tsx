import { PageHeader } from "@/components/workspace/page-header";
import { AiVaultPanel } from "@/components/settings/ai-vault-panel";
import { AcademicScalePanel } from "@/components/settings/academic-scale-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ReminderPanel } from "@/components/settings/reminder-panel";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const settingsSearchParamsSchema = z.object({
  integration: z.enum(["google-connected", "google-error"]).optional(),
});

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ integration?: string }>
}) {
  const params = await searchParams;
  const integration = settingsSearchParamsSchema.safeParse(params).data?.integration;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: preference }, { data: tasks }, { data: profile }, { data: connections }] =
    await Promise.all([
      supabase
        .from("reminder_preferences")
        .select("timezone, quiet_start, quiet_end, enabled, digest_window_days, digest_enabled, digest_time, digest_frequency, digest_weekday")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, due_at, priority")
        .eq("user_id", user.id)
        .is("completed_at", null)
        .not("due_at", "is", null)
        .order("due_at")
        .limit(10),
      supabase
        .from("profiles")
      .select("academic_scale, ai_connected_data_opt_in, current_term_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("integration_connections")
        .select("id, provider, account_key, account_email, status, last_synced_at, error_message, settings")
        .eq("user_id", user.id)
        .in("provider", ["google", "canvas"]),
    ]);

  const googleConnections = (connections ?? []).filter((connection) => connection.provider === "google");
  const canvasConnection = connections?.find((connection) => connection.provider === "canvas") ?? null;
  const { data: canvasCourses } = profile?.current_term_id
    ? await supabase
        .from("subjects")
        .select("id, code, name, archived_at, canvas_course_id")
        .eq("user_id", user.id)
        .eq("term_id", profile.current_term_id)
        .not("canvas_course_id", "is", null)
        .order("code")
    : { data: [] };

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
      <div className="mt-8 max-w-7xl">
        <SettingsNavigation />
        <div className="mt-8 space-y-10">
          {integration === "google-connected" && (
            <p className="rounded-xl border border-teal/20 bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal" role="status">
              Google connected. Select Sync now to import your Calendar events and unread Gmail items.
            </p>
          )}
          {integration === "google-error" && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
              Google could not connect. Confirm your Google test-user access, Google provider credentials, and the Supabase sign-in callback, then try again.
            </p>
          )}
          <IntegrationsPanel canvasCourses={canvasCourses ?? []} initialCanvasConnection={canvasConnection} initialGoogleConnections={googleConnections} />
          <AiVaultPanel connectedDataOptIn={profile?.ai_connected_data_opt_in === true} />
          <AcademicScalePanel
            academicScale={profile?.academic_scale === "gpa" ? "gpa" : "qpi"}
          />
          <ReminderPanel preference={preference} tasks={tasks ?? []} />
        </div>
      </div>
    </main>
  );
}
