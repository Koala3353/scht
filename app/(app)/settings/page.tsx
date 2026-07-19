import { PageHeader } from "@/components/workspace/page-header";
import { AiVaultPanel } from "@/components/settings/ai-vault-panel";
import { AcademicScalePanel } from "@/components/settings/academic-scale-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ReminderPanel } from "@/components/settings/reminder-panel";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: preference }, { data: tasks }, { data: profile }] =
    await Promise.all([
      supabase
        .from("reminder_preferences")
        .select("timezone, quiet_start, quiet_end, enabled")
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
    <main>
      <PageHeader eyebrow="SETTINGS" title="Your workspace controls">
        Connections expose a clear status: connected, syncing, needs
        reauthorization, or error.
      </PageHeader>
      <IntegrationsPanel />
      <AiVaultPanel />
      <AcademicScalePanel
        academicScale={profile?.academic_scale === "gpa" ? "gpa" : "qpi"}
      />
      <ReminderPanel preference={preference} tasks={tasks ?? []} />
    </main>
  );
}
