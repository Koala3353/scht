import { describe, expect, it, vi } from "vitest";

import { saveTaskRemotely } from "../../lib/sync/task-client";
import type { CachedTask } from "../../lib/sync/types";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const task: CachedTask = { id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420", userId, title: "Direct save", kind: "school", dueAt: null, priority: "normal", termId: null, subjectId: null, projectId: null, weightPercent: null, description: "Saved remotely.", links: [], effortMinutes: null, completedAt: null, updatedAt: "2026-07-20T09:00:00.000Z", syncState: "synced", source: "manual", sourceId: null };

describe("Supabase task client", () => {
  it("saves a task through the authenticated server API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [{ id: "save-1", task }], rejected: [] }) })));
    await expect(saveTaskRemotely(userId, task, task.updatedAt)).resolves.toMatchObject({ id: task.id, userId, syncState: "synced" });
    expect(fetch).toHaveBeenCalledWith("/api/sync/tasks", expect.objectContaining({ method: "POST" }));
    vi.unstubAllGlobals();
  });
});
