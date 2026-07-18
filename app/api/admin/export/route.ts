import { NextResponse } from 'next/server';
import { requireOwnerAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  await requireOwnerAdmin();
  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
  const supabase = await createClient();
  const [profile, tasks, subjects, notes, grades] = await Promise.all([
    supabase.from('profiles').select('id, display_name, created_at').eq('id', userId).maybeSingle(),
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('subjects').select('*').eq('user_id', userId),
    supabase.from('notes').select('*').eq('user_id', userId),
    supabase.from('assessment_results').select('*').eq('user_id', userId),
  ]);
  const payload = { exportedAt: new Date().toISOString(), profile: profile.data, tasks: tasks.data ?? [], subjects: subjects.data ?? [], notes: notes.data ?? [], assessmentResults: grades.data ?? [] };
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="scht-${userId}.json"` } });
}
