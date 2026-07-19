import { PageHeader } from "@/components/workspace/page-header";
import { SyllabusManager } from "@/components/subjects/syllabus-manager";
import { SubjectUnitsEditor } from "@/components/subjects/subject-units-editor";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export default async function SubjectsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_term_id")
    .eq("id", user.id)
    .maybeSingle();
  const { data: subjects } = profile?.current_term_id
    ? await supabase
        .from("subjects")
        .select("id, code, name, professor_notes, syllabus_status, units")
        .eq("term_id", profile.current_term_id)
        .is("archived_at", null)
        .order("code")
    : { data: [] };
  const { data: syllabi } = subjects?.length
    ? await supabase
        .from("syllabi")
        .select(
          "id, subject_id, candidate_weights, validation_state, created_at",
        )
        .eq("user_id", user.id)
        .in(
          "subject_id",
          subjects.map((subject) => subject.id),
        )
        .order("created_at", { ascending: false })
    : { data: [] };
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
      <PageHeader eyebrow="CURRENT TERM" title="Subjects">
        Course notes, syllabus review, Canvas state, and grade progress stay
        grouped by class.
      </PageHeader>
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
            <SubjectUnitsEditor
              initialUnits={Number(subject.units)}
              subjectId={subject.id}
            />
            <SyllabusManager
              subjectId={subject.id}
              syllabus={newestSyllabus.get(subject.id) ?? null}
            />
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
