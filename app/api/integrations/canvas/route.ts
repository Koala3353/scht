import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCredentials, encryptCredentials } from "../../../../lib/integrations/credentials";
import { canvasApi, canvasErrorKind, type CanvasAssignment, type CanvasCourse } from "../../../../lib/integrations/canvas";
import { canvasAssignmentHtmlForStorage } from "../../../../lib/integrations/canvas-assignment-content";
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

function compactCanvasText(value: string | null | undefined, fallback: string, maxLength: number) {
  const compact = value?.replace(/\s+/g, " ").trim() || fallback;
  return compact.slice(0, maxLength);
}

function normalisedCourseCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function courseCodesMatch(subjectCode: string, canvasCourse: CanvasCourse) {
  const subject = normalisedCourseCode(subjectCode);
  const canvasCode = canvasCourse.course_code?.trim().toUpperCase() ?? "";
  const canvas = normalisedCourseCode(canvasCode);
  if (!subject || !canvas) return false;
  if (subject === canvas) return true;
  // Canvas commonly adds a section suffix (for example, "MATH 10 A" or
  // "MATH 10 SECTION A") while IPS lists the durable catalog code. Require a
  // visible suffix boundary so MATH 10 cannot be mistaken for MATH 100.
  const subjectPattern = subjectCode.trim().toUpperCase().split(/\s+/).map(escapeRegex).join("\\s*");
  return new RegExp(`^${subjectPattern}(?:$|[\\s\\-–_:])`).test(canvasCode);
}

function assignmentIsFinished(assignment: CanvasAssignment) {
  const submission = assignment.submission;
  const workflowState = submission?.workflow_state?.toLowerCase();
  return submission?.excused === true
    || Boolean(submission?.submitted_at)
    || workflowState === "submitted"
    || workflowState === "graded"
    || workflowState === "pending_review"
    || workflowState === "complete";
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
          account_key: "legacy",
          status: "connected",
          encrypted_credentials: encryptCredentials({ baseUrl, token }),
          settings: { courseCount: courses.length, baseUrl },
          error_message: null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,provider,account_key" });
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
    const { data: existingSubjects, error: existingSubjectError } = await supabase
      .from("subjects")
      .select("id, code, canvas_course_id, archived_at")
      .eq("user_id", user.id)
      .eq("term_id", profile.current_term_id);
    if (existingSubjectError) throw new Error("Could not inspect existing subjects before Canvas sync.");

    const byCanvasCourseId = new Map(
      (existingSubjects ?? []).flatMap((subject) => subject.canvas_course_id ? [[subject.canvas_course_id, subject] as const] : []),
    );
    const unlinkedSubjects = (existingSubjects ?? []).filter((subject) => !subject.canvas_course_id && !subject.archived_at);
    const matchedSubjects: Array<{ id: string; canvas_course_id: string }> = [];
    const subjectLinks: Array<{ subjectId: string; canvasCourseId: string }> = [];
    let unmatchedCourses = 0;
    for (const course of courses) {
      const canvasCourseId = String(course.id);
      const existingCanvasSubject = byCanvasCourseId.get(canvasCourseId);
      if (existingCanvasSubject) {
        // An archived Canvas course is deliberately kept for history, but it
        // must never recreate its assignments in the active workspace.
        if (existingCanvasSubject.archived_at) continue;
        matchedSubjects.push({ id: existingCanvasSubject.id, canvas_course_id: canvasCourseId });
        continue;
      }
      const matchingSubject = unlinkedSubjects.find((subject) => courseCodesMatch(subject.code, course));
      if (matchingSubject) {
        subjectLinks.push({ subjectId: matchingSubject.id, canvasCourseId });
      } else {
        unmatchedCourses += 1;
      }
    }
    const linkedSubjects = await Promise.all(subjectLinks.map(async ({ subjectId, canvasCourseId }) => {
      const { data, error } = await supabase
        .from("subjects")
        .update({ canvas_course_id: canvasCourseId })
        .eq("id", subjectId)
        .select("id, canvas_course_id")
        .single();
      if (error) throw new Error("Could not link an existing subject to its Canvas course.");
      return data;
    }));
    const savedSubjects = [...matchedSubjects, ...linkedSubjects];

    const assignmentCounts = await mapWithConcurrency(savedSubjects ?? [], 3, async (subject) => {
      const assignments = await canvasApi<CanvasAssignment[]>(credentials.baseUrl, credentials.token, `/courses/${subject.canvas_course_id}/assignments?include[]=submission&per_page=100`);
      const completedSourceIds = assignments
        .filter(assignmentIsFinished)
        .map((assignment) => `${subject.canvas_course_id}:${assignment.id}`);
      if (completedSourceIds.length) {
        const { error: completeError } = await supabase
          .from("tasks")
          .update({ completed_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("source", "canvas")
          .in("source_id", completedSourceIds)
          .is("completed_at", null);
        if (completeError) throw new Error("Could not mark submitted Canvas assignments as complete.");
      }
      const tasks = assignments.filter((assignment) => !assignmentIsFinished(assignment)).map((assignment) => ({
        user_id: user.id,
        term_id: profile.current_term_id,
        subject_id: subject.id,
        source: "canvas",
        source_id: `${subject.canvas_course_id}:${assignment.id}`,
        title: compactCanvasText(assignment.name, "Untitled Canvas assignment", 180),
        kind: "school",
        due_at: assignment.due_at,
        priority: "normal",
        weight_percent: null,
        // Task editing and the direct-save API share a 5,000 character limit.
        // Keep imported Canvas assignments within that same durable contract.
        notes: assignment.description?.slice(0, 5_000) ?? null,
        links: assignment.html_url ? [assignment.html_url] : [],
      }));
      if (!tasks.length) return 0;
      // `ignoreDuplicates` issues ON CONFLICT DO NOTHING for the source
      // identity. Concurrent page refreshes therefore preserve existing user
      // edits and return only IDs that this request actually inserted.
      const { data: savedTasks, error: taskError } = await supabase
        .from("tasks")
        .upsert(tasks, { onConflict: "user_id,source,source_id", ignoreDuplicates: true })
        .select("id");
      if (taskError) throw new Error("Could not save Canvas assignments.");
      const sourceIds = tasks.map((task) => task.source_id);
      const { data: persistedTasks, error: persistedTaskError } = await supabase
        .from("tasks")
        .select("id, source_id")
        .eq("user_id", user.id)
        .eq("source", "canvas")
        .in("source_id", sourceIds);
      if (persistedTaskError) throw new Error("Could not match Canvas assignment details.");
      const taskIdBySourceId = new Map((persistedTasks ?? []).map((task) => [task.source_id, task.id]));
      const details = assignments
        .filter((assignment) => !assignmentIsFinished(assignment) && assignment.description?.trim())
        .flatMap((assignment) => {
          const sourceId = `${subject.canvas_course_id}:${assignment.id}`;
          const taskId = taskIdBySourceId.get(sourceId);
          return taskId ? [{
            task_id: taskId,
            user_id: user.id,
            canvas_html: canvasAssignmentHtmlForStorage(assignment.description),
            source_url: assignment.html_url ?? null,
          }] : [];
        });
      if (details.length) {
        const { error: detailError } = await supabase
          .from("canvas_assignment_details")
          .upsert(details, { onConflict: "task_id" });
        if (detailError) throw new Error("Could not save the full Canvas assignment brief.");
      }
      return savedTasks?.length ?? 0;
    });
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({ status: "connected", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", connection.id);
    if (updateError) throw new Error("Canvas data imported, but the connection result could not be saved.");
    return NextResponse.json({
      courses: savedSubjects.length,
      linkedCourses: subjectLinks.length,
      unmatchedCourses,
      assignments: assignmentCounts.reduce((sum, count) => sum + count, 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canvas sync failed.";
    const needsReconnect = canvasErrorKind(error) === "needs_reconnect";
    const { error: updateError } = await supabase.from("integration_connections").update({ status: needsReconnect ? "error" : "connected", error_message: message }).eq("id", connection.id);
    return NextResponse.json({ error: updateError ? "Canvas sync failed and its connection status could not be saved." : message, needsReconnect }, { status: 502 });
  }
}
