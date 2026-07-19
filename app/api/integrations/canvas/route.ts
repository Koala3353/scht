import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCredentials, encryptCredentials } from "../../../../lib/integrations/credentials";
import { canvasApi, type CanvasAssignment, type CanvasCourse } from "../../../../lib/integrations/canvas";
import { normalizeCanvasBaseUrl, validCanvasToken } from "../../../../lib/validation/canvas-input";
import { createClient } from "../../../../lib/supabase/server";

const canvasRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), baseUrl: z.string().max(2048), token: z.string().max(4096) }).strict(),
  z.object({ action: z.literal("sync") }).strict(),
]);
const canvasCredentialSchema = z.object({ baseUrl: z.string().url(), token: z.string().min(8).max(4096) });

function bytes(value: unknown) {
  if (typeof value === "string") return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return Buffer.from(value as Uint8Array);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsedRequest = canvasRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ error: "Use a valid Canvas request." }, { status: 400 });
  const body = parsedRequest.data;

  if (body.action === "connect") {
    const baseUrl = normalizeCanvasBaseUrl(body.baseUrl);
    const token = body.token.trim();
    if (!baseUrl || !validCanvasToken(token)) {
      return NextResponse.json({ error: "Use your school’s secure Canvas URL and a valid personal access token." }, { status: 400 });
    }
    try {
      const courses = await canvasApi<CanvasCourse[]>(baseUrl, token, "/courses?enrollment_state=active&per_page=100");
      const { error } = await supabase
        .from("integration_connections")
        .upsert({
          user_id: user.id,
          provider: "canvas",
          status: "connected",
          encrypted_credentials: encryptCredentials({ baseUrl, token }),
          settings: { courseCount: courses.length, baseUrl },
          error_message: null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,provider" });
      if (error) return NextResponse.json({ error: "Could not securely save this Canvas connection." }, { status: 502 });
      return NextResponse.json({ courses: courses.length });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Canvas connection failed." }, { status: 400 });
    }
  }

  const [{ data: connection, error: connectionError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("integration_connections").select("id, encrypted_credentials").eq("user_id", user.id).eq("provider", "canvas").maybeSingle(),
    supabase.from("profiles").select("current_term_id").eq("id", user.id).maybeSingle(),
  ]);
  if (connectionError || profileError) return NextResponse.json({ error: "Could not read your Canvas connection or current term." }, { status: 502 });
  if (!connection?.encrypted_credentials || !profile?.current_term_id) {
    return NextResponse.json({ error: "Connect Canvas and select a current term first." }, { status: 400 });
  }

  try {
    const credentialResult = canvasCredentialSchema.safeParse(decryptCredentials(bytes(connection.encrypted_credentials)));
    if (!credentialResult.success) throw new Error("Canvas connection needs to be reconnected.");
    const credentials = credentialResult.data;
    const courses = await canvasApi<CanvasCourse[]>(credentials.baseUrl, credentials.token, "/courses?enrollment_state=active&per_page=100");
    const subjects = courses.map((course) => ({
      user_id: user.id,
      term_id: profile.current_term_id,
      code: course.course_code || `CANVAS-${course.id}`,
      name: course.name,
      canvas_course_id: String(course.id),
    }));
    const { data: savedSubjects, error: subjectError } = subjects.length
      ? await supabase.from("subjects").upsert(subjects, { onConflict: "user_id,term_id,code" }).select("id, canvas_course_id")
      : { data: [], error: null };
    if (subjectError) throw new Error("Could not save active Canvas courses.");

    const assignmentCounts = await mapWithConcurrency(savedSubjects ?? [], 3, async (subject) => {
      const assignments = await canvasApi<CanvasAssignment[]>(credentials.baseUrl, credentials.token, `/courses/${subject.canvas_course_id}/assignments?per_page=100`);
      const tasks = assignments.map((assignment) => ({
        user_id: user.id,
        term_id: profile.current_term_id,
        subject_id: subject.id,
        source: "canvas",
        source_id: `${subject.canvas_course_id}:${assignment.id}`,
        title: assignment.name,
        kind: "school",
        due_at: assignment.due_at,
        priority: "normal",
        weight_percent: null,
        notes: assignment.description,
        links: assignment.html_url ? [assignment.html_url] : [],
      }));
      if (!tasks.length) return 0;
      const { data: savedTasks, error: taskError } = await supabase.from("tasks").upsert(tasks, { onConflict: "user_id,source,source_id" }).select("id");
      if (taskError) throw new Error("Could not save Canvas assignments.");
      return savedTasks?.length ?? 0;
    });
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({ status: "connected", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", connection.id);
    if (updateError) throw new Error("Canvas data imported, but the connection result could not be saved.");
    return NextResponse.json({ courses: savedSubjects?.length ?? 0, assignments: assignmentCounts.reduce((sum, count) => sum + count, 0) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canvas sync failed.";
    const { error: updateError } = await supabase.from("integration_connections").update({ status: "error", error_message: message }).eq("id", connection.id);
    return NextResponse.json({ error: updateError ? "Canvas sync failed and its connection status could not be saved." : message }, { status: 502 });
  }
}
