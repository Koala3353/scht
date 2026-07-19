import { NextResponse } from "next/server";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/integrations/credentials";
import {
  canvasApi,
  type CanvasAssignment,
  type CanvasCourse,
} from "@/lib/integrations/canvas";
import {
  normalizeCanvasBaseUrl,
  validCanvasToken,
} from "@/lib/validation/canvas-input";
import { createClient } from "@/lib/supabase/server";

function bytes(value: unknown) {
  if (typeof value === "string")
    return value.startsWith("\\x")
      ? Buffer.from(value.slice(2), "hex")
      : Buffer.from(value, "base64");
  return Buffer.from(value as Uint8Array);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    baseUrl?: string;
    token?: string;
  } | null;

  if (body?.action === "connect") {
    const baseUrl = normalizeCanvasBaseUrl(body.baseUrl);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!baseUrl || !validCanvasToken(token))
      return NextResponse.json(
        {
          error:
            "Use your school’s secure Canvas URL and a valid personal access token.",
        },
        { status: 400 },
      );
    try {
      const courses = await canvasApi<CanvasCourse[]>(
        baseUrl,
        token,
        "/courses?enrollment_state=active&per_page=100",
      );
      const { error } = await supabase
        .from("integration_connections")
        .upsert(
          {
            user_id: user.id,
            provider: "canvas",
            status: "connected",
            encrypted_credentials: encryptCredentials({ baseUrl, token }),
            settings: { courseCount: courses.length, baseUrl },
            error_message: null,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        );
      if (error)
        return NextResponse.json(
          { error: "Could not securely save this Canvas connection." },
          { status: 502 },
        );
      return NextResponse.json({ courses: courses.length });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Canvas connection failed.",
        },
        { status: 400 },
      );
    }
  }

  if (body?.action !== "sync")
    return NextResponse.json(
      { error: "Unsupported Canvas action." },
      { status: 400 },
    );
  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabase
      .from("integration_connections")
      .select("id, encrypted_credentials")
      .eq("user_id", user.id)
      .eq("provider", "canvas")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!connection?.encrypted_credentials || !profile?.current_term_id)
    return NextResponse.json(
      { error: "Connect Canvas and select a current term first." },
      { status: 400 },
    );
  try {
    const credentials = decryptCredentials(
      bytes(connection.encrypted_credentials),
    );
    const courses = await canvasApi<CanvasCourse[]>(
      credentials.baseUrl,
      credentials.token,
      "/courses?enrollment_state=active&per_page=100",
    );
    const subjects = courses.map((course) => ({
      user_id: user.id,
      term_id: profile.current_term_id,
      code: course.course_code || `CANVAS-${course.id}`,
      name: course.name,
      canvas_course_id: String(course.id),
    }));
    if (subjects.length)
      await supabase
        .from("subjects")
        .upsert(subjects, { onConflict: "user_id,term_id,code" });
    const { data: savedSubjects } = await supabase
      .from("subjects")
      .select("id, canvas_course_id")
      .eq("user_id", user.id)
      .eq("term_id", profile.current_term_id)
      .not("canvas_course_id", "is", null);
    let assignmentCount = 0;
    for (const subject of savedSubjects ?? []) {
      const assignments = await canvasApi<CanvasAssignment[]>(
        credentials.baseUrl,
        credentials.token,
        `/courses/${subject.canvas_course_id}/assignments?per_page=100`,
      );
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
      if (tasks.length) {
        await supabase
          .from("tasks")
          .upsert(tasks, { onConflict: "user_id,source,source_id" });
        assignmentCount += tasks.length;
      }
    }
    await supabase
      .from("integration_connections")
      .update({
        status: "connected",
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", connection.id);
    return NextResponse.json({
      courses: courses.length,
      assignments: assignmentCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Canvas sync failed.";
    await supabase
      .from("integration_connections")
      .update({ status: "error", error_message: message })
      .eq("id", connection.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
