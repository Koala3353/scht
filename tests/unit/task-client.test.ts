import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CachedTask } from "../../lib/sync/types";

const cachedTasks = new Map<string, CachedTask>();
const outbox = new Map<string, Record<string, unknown>>();
const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), flush: vi.fn() }));

vi.mock("../../lib/sync/db", () => ({
  taskDb: {
    tasks: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => [...cachedTasks.values()].filter((task) => task.userId === userId)) })) })),
      get: vi.fn(async (id: string) => cachedTasks.get(id)),
      put: vi.fn(async (task: CachedTask) => { cachedTasks.set(task.id, task); }),
      bulkPut: vi.fn(async (tasks: CachedTask[]) => { tasks.forEach((task) => cachedTasks.set(task.id, task)); }),
      update: vi.fn(async (id: string, changes: Partial<CachedTask>) => { const task = cachedTasks.get(id); if (task) cachedTasks.set(id, { ...task, ...changes }); }),
      delete: vi.fn(async (id: string) => { cachedTasks.delete(id); }),
    },
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(async () => [...outbox.values()]) })) })),
      get: vi.fn(async (id: string) => outbox.get(id)),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<unknown>) => callback()),
  },
}));

vi.mock("../../lib/sync/outbox", () => ({
  enqueueTaskMutation: mocks.enqueue,
  flushTaskOutbox: mocks.flush,
}));

import { hydrateTaskCache, saveTaskLocally } from "../../lib/sync/task-client";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const task: CachedTask = {
  id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420", userId, title: "Offline edit", kind: "school", dueAt: null,
  priority: "normal", termId: null, subjectId: null, projectId: null, weightPercent: null, description: "Keep this after reload.",
  links: [], effortMinutes: null, completedAt: null, updatedAt: "2026-07-20T09:00:00.000Z", syncState: "synced", source: "manual", sourceId: null,
};

describe("shared local-first task client", () => {
  beforeEach(() => {
    cachedTasks.clear();
    outbox.clear();
    vi.clearAllMocks();
    mocks.enqueue.mockImplementation(async (mutation: Record<string, unknown>) => { outbox.set(mutation.id as string, mutation); });
    mocks.flush.mockResolvedValue({ accepted: [], rejected: [], networkError: true });
  });

  it("keeps an offline Planner or Subject save in user-scoped cache and durable outbox across hydration", async () => {
    await saveTaskLocally(userId, { ...task, completedAt: "2026-07-20T10:00:00.000Z" }, task.updatedAt);

    expect(cachedTasks.get(task.id)).toMatchObject({ userId, completedAt: "2026-07-20T10:00:00.000Z", syncState: "pending" });
    expect(outbox.size).toBe(1);

    await hydrateTaskCache({ userId, snapshot: [], pruneMissingSnapshot: false });

    expect(cachedTasks.get(task.id)).toMatchObject({ description: "Keep this after reload.", completedAt: "2026-07-20T10:00:00.000Z" });
    expect(outbox.size).toBe(1);
  });
});
