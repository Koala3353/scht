import Dexie, { type EntityTable } from 'dexie';

import type { CachedTask, TaskMutation } from './types';

export class TaskDatabase extends Dexie {
  tasks!: EntityTable<CachedTask, 'id'>;
  outbox!: EntityTable<TaskMutation, 'id'>;

  constructor(name = 'scht-tasks') {
    super(name);

    this.version(1).stores({
      tasks: 'id,termId,dueAt,updatedAt,completedAt',
      outbox: 'id,createdAt,nextAttemptAt',
    });
  }
}

export const taskDb = new TaskDatabase();
