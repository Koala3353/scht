import { createClient } from "@/lib/supabase/server";

function compact(value: string | null, maxLength: number) {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength) || null;
}

/**
 * Creates a small, read-only academic snapshot. Provider payloads are never
 * retained; Gmail and Canvas appear only through the user-owned tasks Scht
 * already imported into their workspace.
 */
export async function workspaceContextForAi(userId: string, currentTermId: string | null) {
  const supabase = await createClient();
  let taskQuery = supabase
    .from("tasks")
    .select("title, due_at, priority, source, notes, subject_id, completed_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(80);
  if (currentTermId) taskQuery = taskQuery.eq("term_id", currentTermId);

  const [tasksResult, subjectsResult, eventsResult, categoriesResult, resultsResult] = await Promise.all([
    taskQuery,
    supabase.from("subjects").select("id, code, name, professor_notes, syllabus_status").eq("user_id", userId).is("archived_at", null).limit(40),
    supabase.from("calendar_events").select("title, starts_at, is_all_day, provider").eq("user_id", userId).gte("starts_at", new Date().toISOString()).order("starts_at").limit(50),
    supabase.from("grade_categories").select("id, subject_id, name, weight_percent").eq("user_id", userId).limit(160),
    supabase.from("assessment_results").select("category_id, score, possible_score").eq("user_id", userId).limit(240),
  ]);
  if (tasksResult.error || subjectsResult.error || eventsResult.error || categoriesResult.error || resultsResult.error) {
    throw new Error("Could not load your workspace context for AI.");
  }

  const subjects = subjectsResult.data ?? [];
  const subjectNames = new Map(subjects.map((subject) => [subject.id, `${subject.code} · ${subject.name}`]));
  const categoryById = new Map((categoriesResult.data ?? []).map((category) => [category.id, category]));
  const context = {
    activeSubjects: subjects.map((subject) => ({
      subject: `${subject.code} · ${subject.name}`,
      syllabusStatus: subject.syllabus_status,
      professorNotes: compact(subject.professor_notes, 500),
    })),
    gradeWeights: (categoriesResult.data ?? []).map((category) => ({
      subject: subjectNames.get(category.subject_id) ?? "Unknown subject",
      category: category.name,
      weightPercent: Number(category.weight_percent),
    })),
    assessmentResults: (resultsResult.data ?? []).flatMap((result) => {
      const category = categoryById.get(result.category_id ?? "");
      return category ? [{ category: category.name, score: Number(result.score), possibleScore: Number(result.possible_score) }] : [];
    }),
    openTasks: (tasksResult.data ?? []).filter((task) => !task.subject_id || subjectNames.has(task.subject_id)).map((task) => ({
      title: task.title,
      source: task.source,
      dueAt: task.due_at,
      priority: task.priority,
      subject: task.subject_id ? (subjectNames.get(task.subject_id) ?? "Hidden or archived subject") : null,
      notes: compact(task.notes, 600),
    })),
    upcomingCalendar: (eventsResult.data ?? []).map((event) => ({
      title: event.title,
      startsAt: event.starts_at,
      isAllDay: event.is_all_day,
      provider: event.provider,
    })),
  };
  return JSON.stringify(context);
}
