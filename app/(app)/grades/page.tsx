import { PageHeader } from "@/components/workspace/page-header";
import { AssessmentForm } from "@/components/grades/assessment-form";
import { AcademicSummary } from "@/components/grades/academic-summary";
import {
  type AssessmentResult,
  type GradeCategory,
} from "@/lib/grades/calculator";
import { requireUser } from "@/lib/auth/guards";
import { requireQuery } from "@/lib/queries/core-page-query-error";
import { taskColumns, toTaskView, type TaskRow } from "@/lib/tasks/task-view";
import { createClient } from "@/lib/supabase/server";

export default async function GradesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [categoriesResult, resultsResult, profileResult] = await Promise.all([
    supabase
      .from("grade_categories")
      .select("id, subject_id, name, weight_percent")
      .eq("user_id", user.id),
    supabase
      .from("assessment_results")
      .select("category_id, score, possible_score")
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("academic_scale, current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const categories = requireQuery(categoriesResult, "grade categories") ?? [];
  const results = requireQuery(resultsResult, "assessment results") ?? [];
  const profile = requireQuery(profileResult, "grades profile");
  const subjects = requireQuery(
    profile?.current_term_id
      ? await supabase
          .from("subjects")
          .select("id, code, name, units")
          .eq("user_id", user.id)
          .eq("term_id", profile.current_term_id)
          .is("archived_at", null)
          .order("code")
      : { data: [], error: null },
    "grade subjects",
  );
  const weightedTaskRows = subjects?.length
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
          .not("weight_percent", "is", null)
          .order("due_at", { ascending: true, nullsFirst: false }),
        "weighted grade tasks",
      )
    : [];
  const academicCategories = categories.map(
    (item) =>
      ({
        id: item.id,
        name: item.name,
        subjectId: item.subject_id,
        weightPercent: Number(item.weight_percent),
      }) satisfies GradeCategory & { subjectId: string },
  );
  const resultRows = results
    .filter((item) => item.category_id)
    .map(
      (item) =>
        ({
          categoryId: item.category_id as string,
          score: Number(item.score),
          possibleScore: Number(item.possible_score),
        }) satisfies AssessmentResult,
    );
  const scale = profile?.academic_scale === "gpa" ? "gpa" : "qpi";
  return (
    <main>
      <PageHeader
        eyebrow={scale === "qpi" ? "ATENEO QPI" : "4.0 GPA"}
        title="Grades"
      >
        Approved syllabus weights and course units calculate your current
        {scale === "qpi" ? " QPI" : " GPA"} as new assessments are recorded.
      </PageHeader>
      <AcademicSummary
        categories={academicCategories}
        results={resultRows}
        scale={scale}
        subjects={(subjects ?? []).map((subject) => ({
          ...subject,
          units: Number(subject.units),
        }))}
        tasks={(weightedTaskRows as TaskRow[]).map(toTaskView)}
      />
      <AssessmentForm
        categories={categories.map((category) => ({
          ...category,
          weight_percent: Number(category.weight_percent),
        }))}
        subjects={subjects ?? []}
      />
    </main>
  );
}
