import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/work/work-manager", () => ({
  WorkManager: ({ tasks, onTaskProjectChange }: { tasks: Array<{ id: string }>; onTaskProjectChange?: (task: { id: string; projectId: string | null; updatedAt: string }) => void }) => <button onClick={() => onTaskProjectChange?.({ id: tasks[0]?.id ?? "", projectId, updatedAt: "2026-07-19T11:00:00.000Z" })} type="button">Assign task to Capstone</button>,
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PlannerWorkspace saves", () => {
  it("retains a failed save for explicit retry instead of leaving a silent pending row", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    render(<PlannerWorkspace currentTermId={termId} projects={[]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit Save failure task" }));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Task sync failed. Retry this saved change."));
    expect(screen.getByRole("button", { name: "Retry saved change" })).not.toBeNull();
  });

  it("surfaces a rejected sync response with an explicit retry", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("mutation-1");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [{ id: "mutation-1", reason: "This task changed on another device.", syncState: "conflict", taskId: task.id }] }) })));
    render(<PlannerWorkspace currentTermId={termId} projects={[]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit Save failure task" }));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("This task changed on another device."));
    expect(screen.getByRole("button", { name: "Retry saved change" })).not.toBeNull();
  });

  it("applies a direct assignment revision before the next task edit", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ accepted: [], rejected: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PlannerWorkspace currentTermId={termId} projects={[{ id: projectId, label: "Capstone", status: "active" }]} subjects={[]} tasks={[task]} terms={[{ id: termId, label: "Fall 2026" }]} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Project"), projectId);
    expect(screen.queryByText("Save failure task")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Assign task to Capstone" }));

    expect(screen.getByText("Save failure task")).not.toBeNull();
    expect(screen.getAllByText("Capstone").length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: "Edit Save failure task" }));
    await user.click(screen.getByRole("button", { name: "Save task" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { mutations: Array<{ baseUpdatedAt: string | null }> };
    expect(request.mutations[0]?.baseUpdatedAt).toBe("2026-07-19T11:00:00.000Z");
  });
});
