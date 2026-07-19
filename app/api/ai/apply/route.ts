import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TaskInputSchema } from '@/lib/validation/task';
import { createClient } from '@/lib/supabase/server';

const ApplyRequestSchema = z.object({
  conversationId: z.string().uuid(),
  confirmed: z.literal(true),
  tasks: z.array(TaskInputSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsedRequest = ApplyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ error: 'Every AI write requires reviewed, valid task details.' }, { status: 400 });
  const { conversationId, tasks } = parsedRequest.data;
  // The proposal is intentionally not retained. Requiring a UUID preserves a
  // request correlation value while each explicit, reviewed submit creates tasks.
  void conversationId;
  const { data: profile } = await supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle();
  const selectedTermId = profile?.current_term_id ?? null;
  const subjectIds = [...new Set(tasks.flatMap((task) => task.subjectId ? [task.subjectId] : []))];
  const projectIds = [...new Set(tasks.flatMap((task) => task.projectId ? [task.projectId] : []))];
  const [subjectChecks, projectChecks] = await Promise.all([
    Promise.all(subjectIds.map((id) => supabase.from('subjects').select('id').eq('id', id).eq('user_id', user.id).maybeSingle())),
    Promise.all(projectIds.map((id) => supabase.from('projects').select('id').eq('id', id).eq('user_id', user.id).maybeSingle())),
  ]);
  if (subjectChecks.some((result) => !result.data) || projectChecks.some((result) => !result.data)) return NextResponse.json({ error: 'Choose a subject and project from your workspace.' }, { status: 400 });
  const rows = tasks.map((task) => ({
    ...(task.id ? { id: task.id } : {}),
    user_id: user.id,
    title: task.title,
    kind: task.kind,
    due_at: task.dueAt ?? null,
    priority: task.priority,
    term_id: task.termId ?? selectedTermId,
    subject_id: task.subjectId ?? null,
    project_id: task.projectId ?? null,
    weight_percent: task.weightPercent ?? null,
    notes: task.description,
    links: task.links,
    effort_minutes: task.effortMinutes ?? null,
    completed_at: task.completedAt ?? null,
    source: 'ai',
  }));
  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ applied: rows.length });
}
