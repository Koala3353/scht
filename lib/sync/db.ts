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

    // A short-lived build registered version 3 without every required store
    // for some installed PWAs. Bump again so those databases receive the
    // missing store even though their IndexedDB version already says "3".
    this.version(4).stores({
      tasks: 'id,userId,termId,dueAt,updatedAt,completedAt,[userId+termId]',
      outbox: 'id,userId,createdAt,nextAttemptAt,[userId+nextAttemptAt]',
    });
  }
}

export const taskDb = new TaskDatabase();

const requiredStores = ['tasks', 'outbox'];
let openingDatabase: Promise<void> | null = null;

function hasRequiredStores() {
  const database = taskDb.backendDB();
  return requiredStores.every((store) => database.objectStoreNames.contains(store));
}

/**
 * Ensure an older installed PWA has all stores before it touches the cache.
 * If IndexedDB was left in an impossible partial schema, rebuild only the
 * local cache; the authenticated server snapshot restores it immediately.
 */
export async function ensureTaskDatabase() {
  if (openingDatabase) return openingDatabase;

  openingDatabase = (async () => {
    await taskDb.open();
    if (hasRequiredStores()) return;

    taskDb.close();
    await taskDb.delete();
    await taskDb.open();

    if (!hasRequiredStores()) {
      throw new Error('Scht could not prepare offline storage in this browser.');
    }
  })().finally(() => {
    openingDatabase = null;
  });

  return openingDatabase;
}
