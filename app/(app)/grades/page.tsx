import { PageHeader } from '@/components/workspace/page-header';
import { calculateGrade, type AssessmentResult, type GradeCategory } from '@/lib/grades/calculator';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function GradesPage() {
  const user = await requireUser(); const supabase = await createClient();
  const { data: categories } = await supabase.from('grade_categories').select('id, subject_id, name, weight_percent').eq('user_id', user.id);
  const { data: results } = await supabase.from('assessment_results').select('category_id, score, possible_score').eq('user_id', user.id);
  const categoryRows = (categories ?? []).map((item) => ({ id: item.id, name: item.name, weightPercent: Number(item.weight_percent) } satisfies GradeCategory));
  const resultRows = (results ?? []).filter((item) => item.category_id).map((item) => ({ categoryId: item.category_id as string, score: Number(item.score), possibleScore: Number(item.possible_score) } satisfies AssessmentResult));
  const summary = calculateGrade(categoryRows, resultRows);
  return <main><PageHeader eyebrow="APPROVED WEIGHTS" title="Grades">Candidate syllabus mappings must be reviewed before they affect your standing.</PageHeader><section className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 sm:grid-cols-3 sm:px-0"><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-teal">Earned weight</p><p className="mt-2 text-3xl font-bold">{summary.earnedPercent}%</p></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-teal">Graded weight</p><p className="mt-2 text-3xl font-bold">{summary.gradedWeightPercent}%</p></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-teal">Current average</p><p className="mt-2 text-3xl font-bold">{summary.projectedPercent ?? '—'}{summary.projectedPercent !== null && '%'}</p></article></section></main>;
}
