import { NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/server';
import { TaskInputSchema, type TaskInput } from '../../../../lib/validation/task';
import type { RejectedTaskMutation, TaskSyncResponse, TaskView } from '../../../../lib/sync/types';
import { taskColumns, toTaskView, type TaskRow } from '../../../../lib/tasks/task-view';

type IncomingMutation = {
  id: unknown;
  userId: unknown;
  operation: unknown;
  payload: unknown;
  baseUpdatedAt: unknown;
};

function normalizeImportedCanvasTask(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const candidate = payload as Record<string, unknown>;
  // Existing Canvas rows from before the import limit may carry a longer
  // description back during a completion update. Preserve the task action and
  // repair that stale imported text on the same server-authoritative save.
  if (candidate.source !== 'canvas' || typeof candidate.description !== 'string') return payload;
  return { ...candidate, description: candidate.description.slice(0, 5_000) };
}

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

    const parsedTask = TaskInputSchema.safeParse(normalizeImportedCanvasTask(mutation.payload));
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

    // Task changes now go directly to Supabase (there is no local outbox), so
    // a client snapshot may be older than a provider sync. Update the owned
    // row server-authoritatively instead of rejecting a valid completion for
    // a stale updated_at timestamp.
    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', parsedTask.data.id)
      .eq('user_id', user.id)
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

    response.rejected.push(rejection(mutation.id, 'This task no longer exists or you no longer have access to it.', 'rejected', undefined, parsedTask.data.id));
  }

  return NextResponse.json(response);
}
