import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ userId: string }> };

function eventStatus(deliveredAt: string | null, errorMessage: string | null) {
  if (deliveredAt) return "sent" as const;
  return errorMessage ? "failed" as const : "pending" as const;
}

export async function GET(_: Request, { params }: Params) {
  await requireOwnerAdmin();
  const { userId } = await params;
  const parsedUserId = z.string().uuid().safeParse(userId);
  if (!parsedUserId.success) return NextResponse.json({ error: "A valid user ID is required." }, { status: 400 });

  const supabase = await createClient();
  const id = parsedUserId.data;
  const [
    profileResult,
    termsResult,
    tasksResult,
    subjectsResult,
    connectionsResult,
    errorsResult,
    queueResult,
    reminderDeliveriesResult,
    digestDeliveriesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, role, display_name, current_term_id, academic_scale, ai_connected_data_opt_in, created_at, updated_at").eq("id", id).maybeSingle(),
    supabase.from("academic_terms").select("id, academic_year, name").eq("user_id", id).order("starts_on"),
    supabase.from("tasks").select("id, title, due_at, completed_at, source, priority, updated_at").eq("user_id", id).order("updated_at", { ascending: false }).limit(25),
    supabase.from("subjects").select("id, code, name, units, syllabus_status").eq("user_id", id).order("code"),
    supabase.from("integration_connections").select("provider, status, last_synced_at, error_message").eq("user_id", id),
    supabase.from("sync_errors").select("id, source, message, created_at").eq("user_id", id).is("resolved_at", null).order("created_at", { ascending: false }).limit(12),
    supabase.from("reminder_queue").select("id, task_id, status, send_at, deferred_reason, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("reminder_deliveries").select("id, reminder_id, delivered_at, error_message, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("email_digest_deliveries").select("id, digest_date, delivered_at, error_message, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(40),
  ]);

  const databaseError = [profileResult, termsResult, tasksResult, subjectsResult, connectionsResult, errorsResult, queueResult, reminderDeliveriesResult, digestDeliveriesResult].find((result) => result.error)?.error;
  if (databaseError) return NextResponse.json({ error: databaseError.message }, { status: 502 });
  const profile = profileResult.data;
  if (!profile) return NextResponse.json({ error: "This user does not have a Scht profile." }, { status: 404 });

  let authUser: { email?: string | null; last_sign_in_at?: string | null } | null = null;
  try {
    authUser = (await createAdminClient().auth.admin.getUserById(id)).data.user;
  } catch {
    // The dashboard remains useful if the server-only Auth lookup is temporarily unavailable.
  }

  const queue = queueResult.data ?? [];
  const queueById = new Map(queue.map((entry) => [entry.id, entry]));
  const taskById = new Map((tasksResult.data ?? []).map((task) => [task.id, task]));
  const reminderDeliveries = (reminderDeliveriesResult.data ?? [])
    .flatMap((delivery) => {
      const reminder = queueById.get(delivery.reminder_id);
      if (!reminder) return [];
      return [{
        id: `reminder-${delivery.id}`,
        recipient: authUser?.email ?? profile.display_name ?? id,
        kind: "Task reminder" as const,
        status: eventStatus(delivery.delivered_at, delivery.error_message),
        occurredAt: delivery.delivered_at ?? delivery.created_at,
        detail: taskById.get(reminder.task_id ?? "")?.title ?? "Scheduled task reminder",
      }];
    });
  const deliveredReminderIds = new Set((reminderDeliveriesResult.data ?? []).map((delivery) => delivery.reminder_id));
  const undeliveredReminders = queue
    .filter((reminder) => !deliveredReminderIds.has(reminder.id) && (reminder.deferred_reason || reminder.status === "pending"))
    .map((reminder) => ({
      id: `queue-${reminder.id}`,
      recipient: authUser?.email ?? profile.display_name ?? id,
      kind: "Task reminder" as const,
      status: reminder.deferred_reason ? "failed" as const : "pending" as const,
      occurredAt: reminder.send_at ?? reminder.created_at,
      detail: reminder.deferred_reason ?? taskById.get(reminder.task_id ?? "")?.title ?? "Queued task reminder",
    }));
  const digestDeliveries = (digestDeliveriesResult.data ?? []).map((delivery) => ({
    id: `digest-${delivery.id}`,
    recipient: authUser?.email ?? profile.display_name ?? id,
    kind: "Scheduled update" as const,
    status: eventStatus(delivery.delivered_at, delivery.error_message),
    occurredAt: delivery.delivered_at ?? delivery.created_at,
    detail: `Digest for ${delivery.digest_date}${delivery.error_message ? ` · ${delivery.error_message}` : ""}`,
  }));
  const currentTerm = (termsResult.data ?? []).find((term) => term.id === profile.current_term_id);

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: authUser?.email ?? null,
      displayName: profile.display_name,
      role: profile.role,
      currentTerm: currentTerm ? `${currentTerm.academic_year}–${currentTerm.academic_year + 1} · ${currentTerm.name}` : null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      academicScale: profile.academic_scale,
      connectedDataOptIn: profile.ai_connected_data_opt_in,
    },
    connections: (connectionsResult.data ?? []).map((connection) => ({ provider: connection.provider, status: connection.status, lastSyncedAt: connection.last_synced_at, errorMessage: connection.error_message })),
    tasks: (tasksResult.data ?? []).map((task) => ({ id: task.id, title: task.title, dueAt: task.due_at, completedAt: task.completed_at, source: task.source, priority: task.priority, updatedAt: task.updated_at })),
    subjects: (subjectsResult.data ?? []).map((subject) => ({ id: subject.id, code: subject.code, name: subject.name, units: Number(subject.units), syllabusStatus: subject.syllabus_status })),
    syncErrors: (errorsResult.data ?? []).map((error) => ({ id: error.id, source: error.source, message: error.message, createdAt: error.created_at })),
    deliveries: [...reminderDeliveries, ...undeliveredReminders, ...digestDeliveries].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 20),
  });
}
