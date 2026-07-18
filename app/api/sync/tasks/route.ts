import { NextResponse } from 'next/server';

import { createClient } from '../../../../lib/supabase/server';
import { TaskInputSchema } from '../../../../lib/validation/task';
import type { RejectedTaskMutation, TaskSyncResponse } from '../../../../lib/sync/types';

type IncomingMutation = {
  id: unknown;
  operation: unknown;
  payload: unknown;
};

function rejection(id: unknown, reason: string): RejectedTaskMutation {
  return { id: typeof id === 'string' ? id : 'unknown', reason };
}

function toTaskRow(task: ReturnType<typeof TaskInputSchema.parse>, userId: string) {
  return {
    ...(task.id ? { id: task.id } : {}),
    user_id: userId,
    title: task.title,
    kind: task.kind,
    due_at: task.dueAt ?? null,
    priority: task.priority,
    term_id: task.termId ?? null,
    subject_id: task.subjectId ?? null,
    weight_percent: task.weightPercent ?? null,
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

    if (mutation.operation !== 'upsert') {
      response.rejected.push(rejection(mutation.id, 'Unsupported mutation operation.'));
      continue;
    }

    const parsedTask = TaskInputSchema.safeParse(mutation.payload);
    if (!parsedTask.success) {
      response.rejected.push(rejection(mutation.id, parsedTask.error.issues[0]?.message ?? 'Invalid task.'));
      continue;
    }

    const { error } = await supabase
      .from('tasks')
      .upsert(toTaskRow(parsedTask.data, user.id), { onConflict: 'id' });

    if (error) {
      response.rejected.push(rejection(mutation.id, error.message));
      continue;
    }

    response.accepted.push(mutation.id);
  }

  return NextResponse.json(response);
}
