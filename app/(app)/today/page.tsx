import { TodayWorkspace } from '@/components/today/today-workspace';
import { requireUser } from '@/lib/auth/guards';
import type { CachedTask } from '@/lib/sync/types';
import { createClient } from '@/lib/supabase/server';

type TaskRow = {
  id: string;
  title: string;
  kind: 'school' | 'work' | 'personal';
  due_at: string | null;
  priority: 'low' | 'normal' | 'high';
  term_id: string | null;
  subject_id: string | null;
  weight_percent: number | null;
  completed_at: string | null;
  updated_at: string;
};

function toCachedTask(row: TaskRow): CachedTask {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    dueAt: row.due_at,
    priority: row.priority,
    termId: row.term_id,
    subjectId: row.subject_id,
    weightPercent: row.weight_percent,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export default async function TodayPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle();
  const selectedTermId = profile?.current_term_id ?? null;
  const { data: tasks } = selectedTermId
    ? await supabase.from('tasks').select('id, title, kind, due_at, priority, term_id, subject_id, weight_percent, completed_at, updated_at').eq('term_id', selectedTermId).order('due_at', { ascending: true, nullsFirst: false })
    : { data: [] as TaskRow[] };

  return <TodayWorkspace initialTasks={(tasks ?? []).map((task) => toCachedTask(task as TaskRow))} selectedTermId={selectedTermId} />;
}
