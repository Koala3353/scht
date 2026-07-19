import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { subjectId?: string; categoryId?: string; title?: string; score?: number; possibleScore?: number; assessedAt?: string | null } | null;
  const score = body?.score; const possibleScore = body?.possibleScore;
  if (!body?.subjectId || !body.categoryId || !body.title?.trim() || typeof score !== 'number' || typeof possibleScore !== 'number' || !Number.isFinite(score) || !Number.isFinite(possibleScore) || score < 0 || possibleScore <= 0) return NextResponse.json({ error: 'A subject, category, title, and valid scores are required.' }, { status: 400 });
  const { data: category } = await supabase.from('grade_categories').select('id').eq('id', body.categoryId).eq('subject_id', body.subjectId).eq('user_id', user.id).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Choose an approved grade category for this subject.' }, { status: 400 });
  const { data, error } = await supabase.from('assessment_results').insert({ user_id: user.id, subject_id: body.subjectId, category_id: body.categoryId, title: body.title.trim(), score, possible_score: possibleScore, assessed_at: body.assessedAt || null }).select('id').single();
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ assessment: data }, { status: 201 });
}
