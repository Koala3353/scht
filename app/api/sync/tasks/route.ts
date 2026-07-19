import { NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/server';
import { TaskInputSchema, type TaskInput } from '../../../../lib/validation/task';
import type { RejectedTaskMutation, TaskSyncResponse, TaskView } from '../../../../lib/sync/types';

type IncomingMutation = {
  id: unknown;
  userId: unknown;
  operation: unknown;
  payload: unknown;
  baseUpdatedAt: unknown;
};

type TaskRow = {
  id: string;
  user_id: string;
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

const taskColumns =
  'id,user_id,title,kind,due_at,priority,term_id,subject_id,project_id,weight_percent,notes,links,effort_minutes,completed_at,updated_at,source,source_id';

function rejection(
  id: unknown,
  reason: string,
  syncState: RejectedTaskMutation['syncState'] = 'rejected',
  task?: TaskView,
  taskId?: string,
): RejectedTaskMutation {
  return {
    id: typeof id === 'string' ? id : 'unknown',
    reason,
    syncState,
    ...(task ? { task } : {}),
    ...(taskId ? { taskId } : {}),
  };
}

function toTaskRow(task: TaskInput, userId: string) {
  return {
    ...(task.id ? { id: task.id } : {}),
    user_id: userId,
    title: task.title,
    kind: task.kind,
    due_at: task.dueAt ?? null,
    priority: task.priority,
    term_id: task.termId ?? null,
    subject_id: task.subjectId ?? null,
    project_id: task.projectId ?? null,
    weight_percent: task.weightPercent ?? null,
    notes: task.description,
    links: task.links,
    effort_minutes: task.effortMinutes ?? null,
    completed_at: task.completedAt ?? null,
  };
}

function toTaskView(row: TaskRow): TaskView {
  return {
    id: row.id,
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
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: { mutations?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 });
  }

  if (!Array.isArray(body?.mutations)) {
    return NextResponse.json({ error: 'Expected a mutations array.' }, { status: 400 });
  }

  const response: TaskSyncResponse = { accepted: [], rejected: [] };

  for (const rawMutation of body.mutations) {
    const mutation = rawMutation as IncomingMutation;
    if (!mutation || typeof mutation.id !== 'string' || mutation.id.length === 0) {
      response.rejected.push(rejection(mutation?.id, 'Mutation id is required.'));
      continue;
    }

    if (mutation.userId !== user.id) {
      response.rejected.push(rejection(mutation.id, 'This mutation belongs to another account.'));
      continue;
    }

    if (mutation.operation !== 'upsert') {
      response.rejected.push(rejection(mutation.id, 'Unsupported mutation operation.'));
      continue;
    }

    if (mutation.baseUpdatedAt !== null && typeof mutation.baseUpdatedAt !== 'string') {
      response.rejected.push(rejection(mutation.id, 'A valid base update time is required.'));
      continue;
    }

    const parsedTask = TaskInputSchema.safeParse(mutation.payload);
    if (!parsedTask.success) {
      response.rejected.push(rejection(mutation.id, parsedTask.error.issues[0]?.message ?? 'Invalid task.'));
      continue;
    }

    if (mutation.baseUpdatedAt !== null && !parsedTask.data.id) {
      response.rejected.push(rejection(mutation.id, 'An existing task id is required.'));
      continue;
    }

    const row = toTaskRow(parsedTask.data, user.id);
    if (mutation.baseUpdatedAt === null) {
      const { data, error } = await supabase.from('tasks').insert(row).select(taskColumns).single();
      if (error || !data) {
        response.rejected.push(rejection(mutation.id, 'Unable to save this task.'));
        continue;
      }
      response.accepted.push({ id: mutation.id, task: toTaskView(data as TaskRow) });
      continue;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', parsedTask.data.id)
      .eq('user_id', user.id)
      .eq('updated_at', mutation.baseUpdatedAt)
      .select(taskColumns)
      .maybeSingle();

    if (error) {
      response.rejected.push(rejection(mutation.id, 'Unable to save this task.'));
      continue;
    }

    if (data) {
      response.accepted.push({ id: mutation.id, task: toTaskView(data as TaskRow) });
      continue;
    }

    const { data: canonical } = await supabase
      .from('tasks')
      .select(taskColumns)
      .eq('id', parsedTask.data.id)
      .eq('user_id', user.id)
      .maybeSingle();
    response.rejected.push(
      rejection(
        mutation.id,
        'This task changed on another device.',
        'conflict',
        canonical ? toTaskView(canonical as TaskRow) : undefined,
        parsedTask.data.id,
      ),
    );
  }

  return NextResponse.json(response);
}
