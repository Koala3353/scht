import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDigestDue, type DigestFrequency } from "@/lib/reminders/digest-schedule";
import { buildTimeline, type DigestEvent, type DigestTask } from "@/lib/reminders/timeline";

type ReminderRow = { id: string; user_id: string; idempotency_key: string; tasks: { title?: string; due_at?: string | null } | null };
type ReminderPreference = {
  user_id: string;
  timezone: string;
  digest_window_days: number | null;
  digest_enabled: boolean | null;
  digest_time: string | null;
  digest_frequency: DigestFrequency | null;
  digest_weekday: number | null;
};
type Digest = {
  days: number;
  timezone: string;
  frequency: DigestFrequency;
  timeline: ReturnType<typeof buildTimeline>;
  gmailReviews: string[];
  summary: { items: number; tasks: number; events: number };
  rangeStart: string;
  rangeEnd: string;
};

function authorized(request: Request) {
  const expected = process.env.REMINDER_DISPATCH_TOKEN;
  return Boolean(expected && request.headers.get("authorization") === "Bearer " + expected);
}

function localParts(now: Date, timezone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return { date: values.year + "-" + values.month + "-" + values.day, time: values.hour + ":" + values.minute };
}

function summaryFor(timeline: ReturnType<typeof buildTimeline>) {
  const events = timeline.filter((item) => item.label === "Google Calendar").length;
  return { items: timeline.length, events, tasks: timeline.length - events };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const [{ data: reminderRows, error: reminderError }, { data: preferenceRows, error: preferenceError }] = await Promise.all([
    supabase.from("reminder_queue").select("id, user_id, task_id, send_at, idempotency_key, tasks(title, due_at)").eq("status", "pending").lte("send_at", now.toISOString()).order("send_at").limit(25),
    supabase.from("reminder_preferences").select("user_id, timezone, digest_window_days, digest_enabled, digest_time, digest_frequency, digest_weekday").eq("digest_enabled", true).limit(50),
  ]);
  if (reminderError || preferenceError) return NextResponse.json({ error: reminderError?.message ?? preferenceError?.message ?? "Could not prepare email delivery." }, { status: 502 });

  const reminders = (reminderRows ?? []) as unknown as ReminderRow[];
  const digestPreferences = (preferenceRows ?? []) as ReminderPreference[];
  const dueDigests = digestPreferences
    .map((preference) => ({ preference, ...localParts(now, preference.timezone || "UTC") }))
    .filter(({ preference, time }) => time >= (preference.digest_time ?? "07:00").slice(0, 5))
    .filter(({ preference }) => isDigestDue({ frequency: preference.digest_frequency, weekday: preference.digest_weekday, now, timezone: preference.timezone || "UTC" }));
  const delivered = dueDigests.length
    ? await supabase.from("email_digest_deliveries").select("user_id, digest_date").in("user_id", dueDigests.map(({ preference }) => preference.user_id))
    : { data: [], error: null };
  if (delivered.error) return NextResponse.json({ error: delivered.error.message }, { status: 502 });

  const sent = new Set((delivered.data ?? []).map((delivery) => delivery.user_id + ":" + delivery.digest_date));
  const digestCandidates = dueDigests.filter(({ preference, date }) => !sent.has(preference.user_id + ":" + date));
  const userIds = [...new Set([...reminders.map((reminder) => reminder.user_id), ...digestCandidates.map(({ preference }) => preference.user_id)])];
  if (!userIds.length) return NextResponse.json({ jobs: [] });

  const allPreferences = new Map(digestPreferences.map((preference) => [preference.user_id, preference]));
  const largestWindow = Math.max(3, ...[...allPreferences.values()].map((preference) => preference.digest_window_days ?? 3));
  const end = new Date(now.getTime() + largestWindow * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: taskRows }, { data: eventRows }, { data: gmailRows }] = await Promise.all([
    supabase.from("tasks").select("id, user_id, title, due_at, source").in("user_id", userIds).is("completed_at", null).gte("due_at", now.toISOString()).lte("due_at", end).limit(250),
    supabase.from("calendar_events").select("id, user_id, title, starts_at, provider").in("user_id", userIds).gte("starts_at", now.toISOString()).lte("starts_at", end).limit(250),
    supabase.from("tasks").select("id, user_id, title").in("user_id", userIds).eq("source", "gmail").is("completed_at", null).order("updated_at", { ascending: false }).limit(75),
  ]);
  const tasksByUser = new Map<string, DigestTask[]>();
  for (const task of (taskRows ?? []) as Array<DigestTask & { user_id: string }>) tasksByUser.set(task.user_id, [...(tasksByUser.get(task.user_id) ?? []), task]);
  const eventsByUser = new Map<string, DigestEvent[]>();
  for (const event of (eventRows ?? []) as Array<DigestEvent & { user_id: string }>) eventsByUser.set(event.user_id, [...(eventsByUser.get(event.user_id) ?? []), event]);
  const gmailByUser = new Map<string, string[]>();
  for (const message of (gmailRows ?? []) as Array<{ user_id: string; title: string }>) {
    const items = gmailByUser.get(message.user_id) ?? [];
    if (items.length < 3) items.push(message.title);
    gmailByUser.set(message.user_id, items);
  }
  const users = new Map(await Promise.all(userIds.map(async (userId) => [userId, (await supabase.auth.admin.getUserById(userId)).data.user?.email] as const)));
  const digestFor = (userId: string): Digest => {
    const preference = allPreferences.get(userId);
    const days = preference?.digest_window_days ?? 3;
    const timeline = buildTimeline(tasksByUser.get(userId) ?? [], eventsByUser.get(userId) ?? [], now, days);
    return {
      days,
      timezone: preference?.timezone ?? "UTC",
      frequency: preference?.digest_frequency === "weekly" ? "weekly" : "daily",
      timeline,
      gmailReviews: gmailByUser.get(userId) ?? [],
      summary: summaryFor(timeline),
      rangeStart: now.toISOString(),
      rangeEnd: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    };
  };
  const dashboardUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://scht-admu.vercel.app").replace(/\/$/, "");
  const reminderJobs = reminders.map((reminder) => ({ id: reminder.id, kind: "reminder", idempotencyKey: reminder.idempotency_key, email: users.get(reminder.user_id), title: reminder.tasks?.title ?? "Upcoming task", dueAt: reminder.tasks?.due_at ?? null, dashboardUrl: dashboardUrl + "/planner", digest: digestFor(reminder.user_id) }));
  const digestJobs = digestCandidates.map(({ preference, date }) => ({ id: "digest:" + preference.user_id + ":" + date, kind: "daily_digest", idempotencyKey: preference.user_id + ":" + date, email: users.get(preference.user_id), title: "Your " + (preference.digest_frequency === "weekly" ? "weekly" : "daily") + " update", dueAt: null, dashboardUrl: dashboardUrl + "/today", digestUserId: preference.user_id, digestDate: date, digest: digestFor(preference.user_id) }));
  return NextResponse.json({ jobs: [...reminderJobs, ...digestJobs].filter((job) => job.email) });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { reminderId?: string; idempotencyKey?: string; success?: boolean; error?: string; kind?: "reminder" | "daily_digest"; digestUserId?: string; digestDate?: string } | null;
  if (!body?.idempotencyKey) return NextResponse.json({ error: "Delivery acknowledgement is required." }, { status: 400 });
  const supabase = createAdminClient();
  if (body.kind === "daily_digest") {
    if (!body.digestUserId || !/^\d{4}-\d{2}-\d{2}$/.test(body.digestDate ?? "")) return NextResponse.json({ error: "Digest acknowledgement is invalid." }, { status: 400 });
    const { error } = await supabase.from("email_digest_deliveries").upsert({ user_id: body.digestUserId, digest_date: body.digestDate, provider: "apps_script", idempotency_key: body.idempotencyKey, delivered_at: body.success ? new Date().toISOString() : null, error_message: body.success ? null : body.error ?? "Delivery failed" }, { onConflict: "user_id,digest_date" });
    return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ acknowledged: true });
  }
  if (!body.reminderId) return NextResponse.json({ error: "Reminder acknowledgement is required." }, { status: 400 });
  const status = body.success ? "delivered" : "pending";
  const update = body.success ? { status, attempts: 1, deferred_reason: null } : { status, deferred_reason: body.error ?? "Delivery failed", attempts: 1 };
  const { error } = await supabase.from("reminder_queue").update(update).eq("id", body.reminderId).eq("idempotency_key", body.idempotencyKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  if (body.success) await supabase.from("reminder_deliveries").upsert({ reminder_id: body.reminderId, provider: "apps_script", idempotency_key: body.idempotencyKey, delivered_at: new Date().toISOString() }, { onConflict: "idempotency_key" });
  return NextResponse.json({ acknowledged: true });
}
