import type { TaskInput } from '@/lib/validation/task';

export type TaskMutationOperation = 'upsert';
export type TaskSyncState = 'pending' | 'conflict' | 'rejected' | 'synced';

export interface TaskView extends TaskInput {
  id: string;
  updatedAt: string;
  /** The integration or workflow that created the task. */
  source: string;
  sourceId: string | null;
}

export interface CachedTask extends TaskView {
  userId: string;
  syncState: TaskSyncState;
  syncError?: string;
  /** Canonical server state retained with a conflict for an explicit resolution. */
  canonicalTask?: TaskView;
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
  /** Set only while this mutation has been handed to an active transport request. */
  inFlight?: boolean;
  syncError?: string;
  canonicalTask?: TaskView;
  /** A user explicitly completed a no-server-version recovery decision. */
  recoveryResolved?: boolean;
}

export type TaskMutationInput = Pick<
  TaskMutation,
  'id' | 'userId' | 'operation' | 'payload' | 'baseUpdatedAt'
> &
  Partial<Pick<TaskMutation, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'syncState' | 'syncError' | 'recoveryResolved'>>;

export interface RejectedTaskMutation {
  id: string;
  /** The affected task, which is deliberately distinct from the mutation id. */
  taskId?: string;
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
  /** A transport failure deferred pending mutations rather than receiving a server response. */
  networkError?: boolean;
}
