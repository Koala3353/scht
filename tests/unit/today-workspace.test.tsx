import { describe, expect, it } from 'vitest';

import { mergeTaskSnapshot, shouldApplyAcceptedTask } from '../../components/tasks/task-types';
import type { CachedTask, TaskMutation } from '../../lib/sync/types';

const userId = '0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f';
const termId = 'f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0';

function task(overrides: Partial<CachedTask> = {}): CachedTask {
  return {
    id: 'f11c73a2-24b7-40ee-88fd-d7bf9a203420',
    userId,
    title: 'Local task',
    kind: 'school',
    dueAt: null,
    priority: 'normal',
    termId,
    subjectId: null,
    projectId: null,
    weightPercent: null,
    description: '',
    links: [],
    effortMinutes: null,
    completedAt: null,
    updatedAt: '2026-07-19T10:00:00.000Z',
    syncState: 'synced',
    source: 'manual',
    sourceId: null,
    ...overrides,
  };
}

describe('mergeTaskSnapshot', () => {
  it('keeps a newer pending local row over an older server snapshot', () => {
    const local = task({ syncState: 'pending', updatedAt: '2026-07-19T11:00:00.000Z' });
    const server = task({ title: 'Server task', updatedAt: '2026-07-19T10:00:00.000Z' });

    expect(mergeTaskSnapshot([local], [server], userId, termId)).toEqual([local]);
  });

  it('does not remove a pending current-term task absent from the snapshot', () => {
    const local = task({ syncState: 'pending' });

    expect(mergeTaskSnapshot([local], [], userId, termId)).toEqual([local]);
  });

  it('filters rows to the active user', () => {
    const otherUserTask = task({ userId: '5184ae1a-fc5a-4724-b2b9-0bd0e0669cad' });

    expect(mergeTaskSnapshot([otherUserTask], [], userId, termId)).toEqual([]);
  });

  it('does not overwrite a newer pending cache row when an older mutation is accepted', () => {
    const local = task({ title: 'Latest local edit', syncState: 'pending', updatedAt: '2026-07-19T12:00:00.000Z' });
    const accepted = { ...local, title: 'Older accepted edit', updatedAt: '2026-07-19T11:00:00.000Z' };
    const pending: TaskMutation[] = [{
      id: 'later-mutation', userId, operation: 'upsert', payload: local, baseUpdatedAt: accepted.updatedAt,
      createdAt: 2, attempts: 0, nextAttemptAt: 0, syncState: 'pending',
    }];

    expect(shouldApplyAcceptedTask(local, accepted, pending)).toBe(false);
  });

  it('preserves imported source context through snapshot reconciliation', () => {
    const imported = task({ source: 'canvas', sourceId: 'course:assignment' });

    expect(mergeTaskSnapshot([], [imported], userId, termId)).toEqual([imported]);
  });
});
