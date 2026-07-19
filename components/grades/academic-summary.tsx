import {
  calculateAcademicIndex,
  calculateGrade,
  type AcademicScale,
  type AssessmentResult,
  type GradeCategory,
} from "../../lib/grades/calculator";
import type { TaskView } from "../../lib/sync/types";

type Subject = { id: string; code: string; name: string; units: number };
type Category = GradeCategory & { subjectId: string };

export function AcademicSummary({
  scale,
  subjects,
  categories,
  results,
  tasks,
}: {
  scale: AcademicScale;
  subjects: Subject[];
  categories: Category[];
  results: AssessmentResult[];
  tasks: TaskView[];
}) {
  const courseGrades = subjects.map((subject) => {
    const subjectCategories = categories.filter(
      (category) => category.subjectId === subject.id,
    );
    const subjectCategoryIds = new Set(
      subjectCategories.map((category) => category.id),
    );
    const summary = calculateGrade(
      subjectCategories,
      results.filter((result) => subjectCategoryIds.has(result.categoryId)),
    );
    return { subject, earnedPercent: summary.earnedPercent, gradedWeightPercent: summary.gradedWeightPercent, percentage: summary.projectedPercent };
  });
  const index = calculateAcademicIndex(
    courseGrades.map((course) => ({
      subjectId: course.subject.id,
      units: course.subject.units,
      percentage: course.percentage,
    })),
    scale,
  );
  const qpiStatus =
    index.value === null
      ? "Add an assessment to begin"
      : index.value >= 3.7
        ? "First Honors range"
        : index.value >= 3.35
          ? "Second Honors range"
          : "Keep building your QPI";
  const label = scale === "qpi" ? "Current QPI" : "Current GPA";
  return (
    <>
      <section className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 sm:grid-cols-3 sm:px-0">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-teal">{label}</p>
          <p className="mt-2 text-3xl font-bold">
            {index.value?.toFixed(2) ?? "—"}
          </p>
          <p className="mt-1 text-sm text-slate-600">Unit-weighted estimate</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-teal">Counted units</p>
          <p className="mt-2 text-3xl font-bold">{index.countedUnits || "—"}</p>
          <p className="mt-1 text-sm text-slate-600">
            Courses with recorded grades
          </p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-teal">
            {scale === "qpi" ? "Honors estimate" : "Scale"}
          </p>
          <p className="mt-2 text-xl font-bold">
            {scale === "qpi" ? qpiStatus : "4.00 maximum"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {scale === "qpi"
              ? "Semestral QPI reference"
              : "Percentage converted to 4.0"}
          </p>
        </article>
      </section>
      <section className="mx-auto mt-6 max-w-5xl px-4 sm:px-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold">
                Subject-by-subject calculation
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Each completed subject is weighted by its course units.
              </p>
            </div>
            <p className="text-sm font-bold text-teal">
              {scale === "qpi" ? "Ateneo QPI" : "4.0 GPA"}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {courseGrades.map((course) => {
              const calculated = index.courses.find(
                (item) => item.subjectId === course.subject.id,
              );
              return (
                <div
                  className="grid grid-cols-[1fr_auto] gap-4 p-4 sm:grid-cols-[1fr_6rem_7rem_6rem]"
                  key={course.subject.id}
                >
                  <div>
                    <p className="font-bold">
                      {course.subject.code} · {course.subject.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {course.subject.units} unit
                      {course.subject.units === 1 ? "" : "s"}
                    </p>
                    {tasks
                      .filter(
                        (task) =>
                          task.subjectId === course.subject.id &&
                          !task.completedAt &&
                          task.weightPercent !== null,
                      )
                      .map((task) => (
                        <a
                          aria-label={`Open task ${task.title}`}
                          className="mt-2 block text-sm font-semibold text-teal underline decoration-teal/30 underline-offset-4"
                          href={`/planner?task=${task.id}`}
                          key={task.id}
                        >
                          {task.title}
                          {task.dueAt
                            ? ` · due ${new Date(task.dueAt).toLocaleDateString()}`
                            : ""}
                        </a>
                      ))}
                  </div>
                  <p className="text-sm sm:self-center">
                    {course.percentage === null
                      ? "No grade yet"
                      : <>Earned: {course.earnedPercent.toFixed(2)}%<br />Projected: {course.percentage.toFixed(2)}% ({course.gradedWeightPercent}% graded)</>}
                  </p>
                  <p className="text-right font-bold text-teal sm:self-center sm:text-left">
                    {calculated?.letter ?? "—"}
                  </p>
                  <p className="text-right text-sm sm:self-center">
                    {calculated ? calculated.point.toFixed(2) : "—"}
                  </p>
                </div>
              );
            })}
            {!courseGrades.length && (
              <p className="p-5 text-sm text-slate-600">
                Add subjects and approved grade weights to calculate your
                academic index.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
