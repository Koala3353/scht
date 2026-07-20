import { PageHeader } from "@/components/workspace/page-header";
import { ProviderResync, type Provider } from "@/components/integrations/provider-resync";
import { SyllabusManager } from "@/components/subjects/syllabus-manager";
import { SubjectTaskQueue } from "@/components/subjects/subject-task-queue";
import { SubjectUnitsEditor } from "@/components/subjects/subject-units-editor";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toCachedTask, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";
import { calculateGrade, type AssessmentResult, type GradeCategory } from "@/lib/grades/calculator";

export default async function SubjectsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = requireQuery(
    await supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
    "subjects profile",
  );
  const subjects = (profile?.current_term_id
    ? requireQuery(
        await supabase
        .from("subjects")
        .select("id, term_id, code, name, professor_notes, syllabus_status, units")
        .eq("term_id", profile.current_term_id)
        .is("archived_at", null)
        .order("code"),
        "subjects",
      )
    : []) ?? [];
  const syllabi = (subjects.length
    ? requireQuery(
        await supabase
        .from("syllabi")
        .select(
          "id, subject_id, candidate_weights, validation_state, created_at",
        )
        .eq("user_id", user.id)
        .in(
          "subject_id",
          subjects.map((subject) => subject.id),
        )
        .order("created_at", { ascending: false }),
        "subject syllabi",
      )
    : []) ?? [];
  const taskRows = (subjects.length
    ? requireQuery(
        await supabase
          .from("tasks")
          .select(taskColumns)
          .eq("user_id", user.id)
          .in(
            "subject_id",
            subjects.map((subject) => subject.id),
          )
          .is("completed_at", null)
          .order("due_at", { ascending: true, nullsFirst: false }),
        "subject tasks",
      )
    : []) ?? [];
  const [categoriesResult, resultsResult, termsResult, projectsResult, connectionsResult] = await Promise.all([
    subjects.length ? supabase.from("grade_categories").select("id, subject_id, name, weight_percent").eq("user_id", user.id).in("subject_id", subjects.map((subject) => subject.id)) : Promise.resolve({ data: [], error: null }),
    supabase.from("assessment_results").select("category_id, score, possible_score").eq("user_id", user.id),
    supabase.from("academic_terms").select("id, name, academic_year").eq("user_id", user.id).order("starts_on"),
    supabase.from("projects").select("id, name, status").eq("user_id", user.id).order("created_at"),
    supabase
      .from("integration_connections")
      .select("provider")
      .eq("user_id", user.id)
      .eq("provider", "canvas")
      .eq("status", "connected"),
  ]);
  const categories = requireQuery(categoriesResult, "subject grade categories") ?? [];
  const results = requireQuery(resultsResult, "subject assessment results") ?? [];
  const terms = requireQuery(termsResult, "subject task terms") ?? [];
  const projects = requireQuery(projectsResult, "subject task projects") ?? [];
  const connections = requireQuery(connectionsResult, "subject connections") ?? [];
  const savedProviders: Provider[] = connections.flatMap(
    (connection) => connection.provider === "canvas" ? ["canvas" as const] : [],
  );
  const openTasksBySubject = new Map<string, ReturnType<typeof toCachedTask>[]>();
  for (const row of taskRows as TaskRow[]) {
    const task = toCachedTask(row);
    if (!task.subjectId) continue;
    const queue = openTasksBySubject.get(task.subjectId) ?? [];
    queue.push(task);
    openTasksBySubject.set(task.subjectId, queue);
  }
  const newestSyllabus = new Map<
    string,
    {
      id: string;
      candidate_weights: { name: string; weightPercent: number }[];
      validation_state: string;
    }
  >();
  for (const syllabus of syllabi ?? [])
    if (!newestSyllabus.has(syllabus.subject_id))
      newestSyllabus.set(syllabus.subject_id, {
        id: syllabus.id,
        candidate_weights: Array.isArray(syllabus.candidate_weights)
          ? (syllabus.candidate_weights as {
              name: string;
              weightPercent: number;
            }[])
          : [],
        validation_state: syllabus.validation_state,
      });
  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="CURRENT TERM" title="Subjects">
          Course notes, syllabus review, Canvas state, and grade progress stay
          grouped by class.
        </PageHeader>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-3">
            <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal/30 px-3 text-sm font-bold text-teal transition hover:bg-[#e6f2f0]" href="/onboarding?step=curriculum">Import or update IPS</a>
            <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-bold text-ink transition hover:bg-slate-50" href="/onboarding?step=curriculum#manual-subject">Add a subject manually</a>
          </div>
          <ProviderResync providers={savedProviders} />
        </div>
      </div>
      <section className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-0">
        {(subjects ?? []).map((subject) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={subject.id}
          >
            <p className="font-bold text-teal">{subject.code}</p>
            <h2 className="mt-1 text-lg font-bold">{subject.name}</h2>
            <p className="mt-3 text-sm text-slate-600">
              {subject.professor_notes || "No professor notes yet."}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
              Syllabus: {subject.syllabus_status}
            </p>
            {(() => {
              const subjectCategories = categories.filter((category) => category.subject_id === subject.id).map((category) => ({ id: category.id, name: category.name, weightPercent: Number(category.weight_percent) }) satisfies GradeCategory);
              const subjectCategoryIds = new Set(subjectCategories.map((category) => category.id));
              const standing = calculateGrade(subjectCategories, results.filter((result) => result.category_id && subjectCategoryIds.has(result.category_id)).map((result) => ({ categoryId: result.category_id as string, score: Number(result.score), possibleScore: Number(result.possible_score) }) satisfies AssessmentResult));
              const approvedWeight = subjectCategories.reduce((total, category) => total + category.weightPercent, 0);
              return <div className="mt-2 text-sm text-slate-700"><p>Approved weights: {approvedWeight}%</p><p>Current calculated standing: {standing.projectedPercent === null ? "No assessed work yet" : `${standing.projectedPercent.toFixed(2)}% projected from ${standing.gradedWeightPercent}% graded`}</p></div>;
            })()}
            {(() => {
              const openTasks = openTasksBySubject.get(subject.id) ?? [];
              const weekFromNow = Date.now() + 7 * 86_400_000;
              const dueThisWeek = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() <= weekFromNow).length;
              const gradeHeavy = openTasks.filter((task) => (task.weightPercent ?? 0) >= 15).length;
              return <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f7faf9] p-3 text-center text-xs"><div><p className="text-lg font-black text-teal">{openTasks.length}</p><p className="font-semibold text-slate-600">Open work</p></div><div><p className="text-lg font-black text-teal">{dueThisWeek}</p><p className="font-semibold text-slate-600">Due this week</p></div><div><p className="text-lg font-black text-action">{gradeHeavy}</p><p className="font-semibold text-slate-600">High impact</p></div></div>;
            })()}
            <p className="mt-3 text-xs font-semibold text-slate-500">Canvas connection: {connections.length ? "linked and ready to resync" : "not connected"} · Syllabus: {subject.syllabus_status}</p>
            <SubjectUnitsEditor
              initialUnits={Number(subject.units)}
              subjectId={subject.id}
            />
            <SyllabusManager
              subjectId={subject.id}
              syllabus={newestSyllabus.get(subject.id) ?? null}
            />
            <SubjectTaskQueue approvedCategoryLabels={categories.filter((category) => category.subject_id === subject.id).map((category) => category.name)} currentTermId={profile?.current_term_id ?? null} initialTasks={openTasksBySubject.get(subject.id) ?? []} projects={projects.map((project) => ({ id: project.id, label: project.name, status: project.status as "active" | "archived" }))} representedSubjectId={subject.id} subjects={subjects.map((item) => ({ id: item.id, termId: item.term_id, label: `${item.code} · ${item.name}` }))} terms={terms.map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))} userId={user.id} />
          </article>
        ))}
      </section>
      {!subjects?.length && (
        <p className="mx-auto mt-8 max-w-5xl px-4 text-slate-600 sm:px-0">
          Activate curriculum items during onboarding to start building your
          subject workspace.
        </p>
      )}
    </main>
  );
}
