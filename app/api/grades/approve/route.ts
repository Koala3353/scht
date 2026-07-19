import { NextResponse } from 'next/server';
import { candidateWeightsAreComplete, type CandidateWeight } from '@/lib/syllabus/weights';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { subjectId?: string; syllabusId?: string; weights?: CandidateWeight[] } | null;
  if (!body?.subjectId || !body.syllabusId || !Array.isArray(body.weights) || !candidateWeightsAreComplete(body.weights)) return NextResponse.json({ error: 'Approved grade weights must total exactly 100%.' }, { status: 400 });
  const { data: syllabus } = await supabase.from('syllabi').select('id').eq('id', body.syllabusId).eq('subject_id', body.subjectId).eq('user_id', user.id).maybeSingle();
  if (!syllabus) return NextResponse.json({ error: 'Syllabus not found.' }, { status: 404 });
  await supabase.from('grade_categories').delete().eq('user_id', user.id).eq('subject_id', body.subjectId);
  const { error } = await supabase.from('grade_categories').insert(body.weights.map((weight) => ({ user_id: user.id, subject_id: body.subjectId, source_syllabus_id: body.syllabusId, name: weight.name, weight_percent: weight.weightPercent, approved_at: new Date().toISOString() })));
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  await Promise.all([supabase.from('syllabi').update({ approved_weights: body.weights, validation_state: 'approved', reviewed_at: new Date().toISOString() }).eq('id', body.syllabusId), supabase.from('subjects').update({ syllabus_status: 'approved' }).eq('id', body.subjectId)]);
  return NextResponse.json({ approved: true });
}
