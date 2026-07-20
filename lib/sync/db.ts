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

    this.version(2)
      .stores({
        tasks: 'id,userId,termId,dueAt,updatedAt,completedAt,[userId+termId]',
        outbox: 'id,userId,createdAt,nextAttemptAt,[userId+nextAttemptAt]',
      })
      .upgrade(async (transaction) => {
        // Version 1 records cannot be associated with an account safely.
        await transaction.table('tasks').clear();
        await transaction.table('outbox').clear();
      });

    // Some early browser installs were created before the durable outbox was
    // fully registered. A schema-only bump makes IndexedDB create that store
    // on the next open, without clearing the user-scoped cache.
    this.version(3).stores({
      tasks: 'id,userId,termId,dueAt,updatedAt,completedAt,[userId+termId]',
      outbox: 'id,userId,createdAt,nextAttemptAt,[userId+nextAttemptAt]',
    });
  }
}

export const taskDb = new TaskDatabase();
