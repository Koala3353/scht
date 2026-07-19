import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CachedTask } from "../../lib/sync/types";

const saveTask = vi.fn();
vi.mock("../../components/tasks/use-task-sync-workspace", () => ({
  useTaskSyncWorkspace: ({ initialTasks }: { initialTasks: CachedTask[] }) => ({ tasks: initialTasks, saveTask, syncState: "Synced" }),
}));

import { CalendarWorkspace } from "../../components/calendar/calendar-workspace";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const task: CachedTask = {
  id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420", userId, title: "Canvas reflection", kind: "school", dueAt: "2026-07-22T09:15:00.000Z",
  priority: "high", termId: "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0", subjectId: "451f818e-93c7-4b02-82d1-712acdf8183a", projectId: null, weightPercent: 20,
  description: "Use the lecture notes.", links: ["https://canvas.example.edu/assignments/42"], effortMinutes: 45, completedAt: null,
  updatedAt: "2026-07-20T09:00:00.000Z", syncState: "synced", source: "canvas", sourceId: "42:1",
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CalendarWorkspace", () => {
  it("renders canonical task controls and leaves provider events as read-only links", async () => {
    render(<CalendarWorkspace approvedCategoryLabelsBySubject={{ [task.subjectId!]: ["Reflections"] }} currentTermId={task.termId} events={[{ id: "event-1", title: "Lecture", startsAt: "2026-07-22T11:00:00.000Z", eventUrl: "https://calendar.example.edu/event/1", provider: "google_calendar", isAllDay: false }]} initialTasks={[task]} projects={[]} range={{ from: "2026-07-20T00:00:00.000Z", to: "2026-07-27T00:00:00.000Z" }} subjects={[{ id: task.subjectId!, termId: task.termId!, label: "MATH 121 · Quantitative reasoning" }]} terms={[{ id: task.termId!, label: "Fall 2026" }]} timezone="UTC" userId={userId} />);

    expect(screen.getByText("Use the lecture notes.")).not.toBeNull();
    expect(screen.getByText("Canvas")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Open source link" }).getAttribute("href")).toBe(task.links[0]);
    expect(screen.getByRole("link", { name: "Open event" }).getAttribute("target")).toBe("_blank");

    await userEvent.setup().click(screen.getByRole("button", { name: "Complete Canvas reflection" }));
    expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, completedAt: expect.any(String) }), task.updatedAt);
  });
});
