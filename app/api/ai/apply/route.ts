import { NextResponse } from 'next/server';
import { TaskInputSchema } from '@/lib/validation/task';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { conversationId?: string; confirmed?: boolean; tasks?: unknown[] } | null;
  if (!body?.conversationId || !body.confirmed || !Array.isArray(body.tasks)) return NextResponse.json({ error: 'Every AI write requires an explicit review confirmation.' }, { status: 400 });
  const { data: conversation } = await supabase.from('ai_conversations').select('id').eq('id', body.conversationId).eq('user_id', user.id).is('applied_at', null).maybeSingle();
  if (!conversation) return NextResponse.json({ error: 'Proposal is unavailable or was already applied.' }, { status: 404 });
  const parsed = body.tasks.map((task) => TaskInputSchema.safeParse(task));
  if (parsed.some((result) => !result.success)) return NextResponse.json({ error: 'A proposed task was invalid.' }, { status: 400 });
  const rows = parsed.flatMap((result) => result.success ? [{ ...(result.data.id ? { id: result.data.id } : {}), user_id: user.id, title: result.data.title, kind: result.data.kind, due_at: result.data.dueAt ?? null, priority: result.data.priority, term_id: result.data.termId ?? null, subject_id: result.data.subjectId ?? null, project_id: result.data.projectId ?? null, weight_percent: result.data.weightPercent ?? null, notes: result.data.description, links: result.data.links, effort_minutes: result.data.effortMinutes ?? null, completed_at: result.data.completedAt ?? null, source: 'ai' }] : []);
  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  await supabase.from('ai_conversations').update({ applied_at: new Date().toISOString() }).eq('id', conversation.id);
  return NextResponse.json({ applied: rows.length });
}
