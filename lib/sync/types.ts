import type { TaskInput } from '@/lib/validation/task';

export type TaskMutationOperation = 'upsert';

export interface CachedTask extends TaskInput {
  id: string;
  updatedAt: string;
}

export interface TaskMutation {
  id: string;
  operation: TaskMutationOperation;
  payload: TaskInput;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
}

export type TaskMutationInput = Pick<TaskMutation, 'id' | 'operation' | 'payload'> &
  Partial<Pick<TaskMutation, 'createdAt' | 'attempts' | 'nextAttemptAt'>>;

export interface RejectedTaskMutation {
  id: string;
  reason: string;
}

export interface TaskSyncResponse {
  accepted: string[];
  rejected: RejectedTaskMutation[];
}
