import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnerAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const owner = await requireOwnerAdmin();
  const userId = z.string().uuid().safeParse(new URL(request.url).searchParams.get('userId'));
  if (!userId.success) return NextResponse.json({ error: 'A valid userId is required.' }, { status: 400 });
  const supabase = await createClient();
  const [profile, tasks, subjects, grades] = await Promise.all([
    supabase.from('profiles').select('id, display_name, created_at').eq('id', userId.data).maybeSingle(),
    supabase.from('tasks').select('*').eq('user_id', userId.data),
    supabase.from('subjects').select('*').eq('user_id', userId.data),
    supabase.from('assessment_results').select('*').eq('user_id', userId.data),
  ]);
  const payload = { exportedAt: new Date().toISOString(), profile: profile.data, tasks: tasks.data ?? [], subjects: subjects.data ?? [], assessmentResults: grades.data ?? [] };
  const { error: auditError } = await supabase.from('admin_audit_logs').insert({ actor_id: owner.id, action: 'EXPORT_USER_DATA', target_table: 'profiles', target_id: userId.data, details: { format: 'json' } });
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 502 });
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="scht-${userId.data}.json"` } });
}
