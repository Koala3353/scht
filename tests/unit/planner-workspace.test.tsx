import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const cachedTasks = new Map<string, Record<string, unknown>>();
const queuedMutations = new Map<string, Record<string, unknown>>();

vi.mock("../../lib/sync/db", () => ({
  taskDb: {
    tasks: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => [...cachedTasks.values()].filter((task) => task.userId === userId)) })) })),
      get: vi.fn(async (id: string) => cachedTasks.get(id)),
      put: vi.fn(async (task: Record<string, unknown>) => { cachedTasks.set(task.id as string, task); }),
      bulkPut: vi.fn(async (items: Record<string, unknown>[]) => { items.forEach((task) => cachedTasks.set(task.id as string, task)); }),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => { cachedTasks.set(id, { ...cachedTasks.get(id), ...changes }); }),
      delete: vi.fn(async (id: string) => { cachedTasks.delete(id); }),
    },
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn((userId: string) => ({ toArray: vi.fn(async () => [...queuedMutations.values()].filter((mutation) => mutation.userId === userId)) })) })),
      get: vi.fn(async (id: string) => queuedMutations.get(id)),
      put: vi.fn(async (mutation: Record<string, unknown>) => { queuedMutations.set(mutation.id as string, mutation); }),
      update: vi.fn(async (id: string, changes: Record<string, unknown>) => { queuedMutations.set(id, { ...queuedMutations.get(id), ...changes }); }),
      delete: vi.fn(async (id: string) => { queuedMutations.delete(id); }),
    },
    transaction: vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<unknown>) => callback()),
  },
}));

vi.mock("../../components/work/work-manager", () => ({
  WorkManager: ({ tasks, onSaveTask }: { tasks: CachedTask[]; onSaveTask: (task: CachedTask, baseUpdatedAt: string | null) => Promise<void> }) => <button onClick={() => { const currentTask = tasks[0]; if (currentTask) void onSaveTask({ ...currentTask, projectId }, currentTask.updatedAt); }} type="button">Assign task to Capstone</button>,
}));

import { PlannerWorkspace } from "../../components/planner/planner-workspace";
import type { CachedTask } from "../../lib/sync/types";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";
const projectId = "7b95f593-b58f-4550-a0ba-4c824e7e343a";
const task: CachedTask = {
  id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420",
  userId,
  title: "Save failure task",
  kind: "school",
  dueAt: "2026-07-22T09:00:00.000Z",
  priority: "normal",
  termId,
  subjectId: null,
  projectId: null,
  weightPercent: null,
  description: "",
  links: [],
  effortMinutes: null,
  completedAt: null,
  updatedAt: "2026-07-19T10:00:00.000Z",
  syncState: "synced",
  source: "manual",
  sourceId: null,
};

afterEach(() => { cleanup(); cachedTasks.clear(); queuedMutations.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PlannerWorkspace saves", () => {
  it("opens a valid linked task directly in the shared editor", () => {
    render(<PlannerWorkspace currentTermId={termId} focusedTaskId={task.id} projects={[]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);

    expect(screen.getByLabelText("Description")).not.toBeNull();
    expect(screen.getByDisplayValue("Save failure task")).not.toBeNull();
  });

  it("retains a failed save for explicit retry instead of leaving a silent pending row", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    render(<PlannerWorkspace currentTermId={termId} projects={[]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit Save failure task" }));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Task sync failed. Retry this saved change."));
    expect(screen.getByRole("button", { name: "Retry saved change" })).not.toBeNull();
  });

  it("surfaces a rejected sync response with an explicit retry", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("mutation-1");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [{ id: "mutation-1", reason: "This task changed on another device.", syncState: "conflict", taskId: task.id }] }) })));
    render(<PlannerWorkspace currentTermId={termId} projects={[]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit Save failure task" }));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("This task changed on another device."));
    expect(screen.getByRole("button", { name: "Retry saved change" })).not.toBeNull();
  });

  it("queues a project assignment through the shared task mutation with its revision", async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const mutation = (JSON.parse(String(options.body)) as { mutations: Array<{ id: string }> }).mutations[0]!;
      return { ok: true, json: async () => ({ accepted: [{ id: mutation.id, task: { ...task, projectId, updatedAt: "2026-07-19T11:00:00.000Z" } }], rejected: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PlannerWorkspace currentTermId={termId} projects={[{ id: projectId, label: "Capstone", status: "active" }]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Assign task to Capstone" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { mutations: Array<{ baseUpdatedAt: string | null; payload: CachedTask }> };
    expect(request.mutations[0]?.baseUpdatedAt).toBe(task.updatedAt);
    expect(request.mutations[0]?.payload.projectId).toBe(projectId);
  });

  it("retains an offline project assignment in the task cache and outbox", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    render(<PlannerWorkspace currentTermId={termId} projects={[{ id: projectId, label: "Capstone", status: "active" }]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Assign task to Capstone" }));

    await waitFor(() => expect(cachedTasks.get(task.id)).toMatchObject({ projectId, syncState: "pending" }));
    expect([...queuedMutations.values()]).toEqual([expect.objectContaining({ userId, payload: expect.objectContaining({ id: task.id, projectId }) })]);
  });

  it("surfaces a project assignment conflict without losing the durable task edit", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("assignment-mutation");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [{ id: "assignment-mutation", taskId: task.id, reason: "This task changed on another device.", syncState: "conflict", task: { ...task, updatedAt: "2026-07-19T11:00:01.000Z" } }] }) })));
    render(<PlannerWorkspace currentTermId={termId} projects={[{ id: projectId, label: "Capstone", status: "active" }]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} userId={userId} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Assign task to Capstone" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("This task changed on another device."));
    expect([...queuedMutations.values()]).toEqual([expect.objectContaining({ syncState: "conflict", payload: expect.objectContaining({ projectId }) })]);
  });
});
