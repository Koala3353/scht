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
  project_id: string | null;
  weight_percent: number | null;
  notes: string | null;
  links: string[] | null;
  effort_minutes: number | null;
  completed_at: string | null;
  updated_at: string;
  source: string;
  source_id: string | null;
};

function toCachedTask(row: TaskRow, userId: string): CachedTask {
  return {
    id: row.id,
    userId,
    title: row.title,
    kind: row.kind,
    dueAt: row.due_at,
    priority: row.priority,
    termId: row.term_id,
    subjectId: row.subject_id,
    projectId: row.project_id,
    weightPercent: row.weight_percent,
    description: row.notes ?? '',
    links: row.links ?? [],
    effortMinutes: row.effort_minutes,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    source: row.source,
    sourceId: row.source_id,
    syncState: 'synced',
  };
}

export default async function TodayPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle();
  const selectedTermId = profile?.current_term_id ?? null;
  const [{ data: tasks }, { data: terms }, { data: subjects }, { data: projects }] = await Promise.all([selectedTermId
    ? await supabase.from('tasks').select('id, title, kind, due_at, priority, term_id, subject_id, project_id, weight_percent, notes, links, effort_minutes, completed_at, updated_at, source, source_id').eq('term_id', selectedTermId).order('due_at', { ascending: true, nullsFirst: false })
    : Promise.resolve({ data: [] as TaskRow[] }),
    supabase.from('academic_terms').select('id, name, academic_year').eq('user_id', user.id).order('starts_on'),
    supabase.from('subjects').select('id, term_id, code, name').eq('user_id', user.id),
    supabase.from('projects').select('id, name, status').eq('user_id', user.id).order('created_at'),
  ]);

  return <TodayWorkspace initialTasks={(tasks ?? []).map((task) => toCachedTask(task as TaskRow, user.id))} projects={(projects ?? []).map((project) => ({ id: project.id, label: project.name, status: project.status as 'active' | 'archived' }))} selectedTermId={selectedTermId} subjects={(subjects ?? []).map((subject) => ({ id: subject.id, termId: subject.term_id, label: `${subject.code} · ${subject.name}` }))} terms={(terms ?? []).map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))} userId={user.id} />;
}
