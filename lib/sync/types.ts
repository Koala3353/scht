import type { TaskInput } from '@/lib/validation/task';

export type TaskMutationOperation = 'upsert';
export type TaskSyncState = 'pending' | 'conflict' | 'rejected' | 'synced';

export interface TaskView extends TaskInput {
  id: string;
  updatedAt: string;
}

export interface CachedTask extends TaskView {
  userId: string;
  syncState: TaskSyncState;
  syncError?: string;
}

export interface TaskMutation {
  id: string;
  userId: string;
  operation: TaskMutationOperation;
  payload: TaskInput;
  baseUpdatedAt: string | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  syncState: TaskSyncState;
  syncError?: string;
  canonicalTask?: TaskView;
}

export type TaskMutationInput = Pick<
  TaskMutation,
  'id' | 'userId' | 'operation' | 'payload' | 'baseUpdatedAt'
> &
  Partial<Pick<TaskMutation, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'syncState' | 'syncError'>>;

export interface RejectedTaskMutation {
  id: string;
  reason: string;
  task?: TaskView;
  syncState: Extract<TaskSyncState, 'conflict' | 'rejected'>;
}

export interface AcceptedTaskMutation {
  id: string;
  task: TaskView;
}

export interface TaskSyncResponse {
  accepted: AcceptedTaskMutation[];
  rejected: RejectedTaskMutation[];
  nextRetryAt?: number;
}
