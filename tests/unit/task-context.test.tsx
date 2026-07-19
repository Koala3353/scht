import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/tasks/use-task-sync-workspace", () => ({
  useTaskSyncWorkspace: ({ initialTasks }: { initialTasks: CachedTask[] }) => ({
    tasks: initialTasks,
    saveTask: () => undefined,
    retrySynchronization: () => undefined,
    syncState: "Synced",
  }),
}));

import { AcademicSummary } from "../../components/grades/academic-summary";
import { SubjectTaskQueue } from "../../components/subjects/subject-task-queue";
import { TaskList } from "../../components/tasks/task-list";
import { selectAgendaTasks } from "../../components/today/agenda";
import { calendarEntries } from "../../lib/calendar/entries";
import type { CachedTask, TaskView } from "../../lib/sync/types";

const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";
const subjectId = "451f818e-93c7-4b02-82d1-712acdf8183a";

const weightedTask: TaskView = {
  id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420",
  title: "Submit weighted reflection",
  kind: "school",
  dueAt: "2026-07-22T09:15:00.000Z",
  priority: "high",
  termId,
  subjectId,
  projectId: null,
  weightPercent: 20,
  description: "Use the lecture notes.",
  links: [],
  effortMinutes: 45,
  completedAt: null,
  updatedAt: "2026-07-19T10:00:00.000Z",
  source: "canvas",
  sourceId: "canvas-42",
};

afterEach(cleanup);

describe("academic task context", () => {
  it("keeps a selected-term Gmail task visible in Today, Tasks, and Calendar", () => {
    const gmailTask: CachedTask = {
      ...weightedTask,
      source: "gmail",
      sourceId: "gmail-10",
      userId: "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f",
      syncState: "synced",
    };

    expect(selectAgendaTasks([gmailTask], termId)).toEqual([gmailTask]);
    expect(calendarEntries([gmailTask], [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `task-${gmailTask.id}`, type: "task", task: gmailTask }),
    ]));

    render(
      <TaskList
        onSave={() => undefined}
        projects={[]}
        subjects={[{ id: subjectId, label: "MATH 121 · Quantitative reasoning", termId }]}
        tasks={[gmailTask]}
        terms={[{ id: termId, label: "Fall 2026" }]}
        userId={gmailTask.userId}
      />,
    );

    expect(screen.getByText("Gmail")).not.toBeNull();
  });

  it("links an incomplete weighted task beside its course grade", () => {
    render(
      <AcademicSummary
        categories={[]}
        results={[]}
        scale="qpi"
        subjects={[{ id: subjectId, code: "MATH 121", name: "Quantitative reasoning", units: 3 }]}
        tasks={[weightedTask]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open task Submit weighted reflection" }).getAttribute("href"),
    ).toBe(`/planner?task=${weightedTask.id}`);
  });

  it("shows a subject's open task on its subject-card queue", () => {
    const queuedTask: CachedTask = {
      ...weightedTask,
      userId: "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f",
      syncState: "synced",
    };
    render(
      <SubjectTaskQueue
        approvedCategoryLabels={["Reflections"]}
        currentTermId={termId}
        initialTasks={[queuedTask]}
        projects={[]}
        representedSubjectId={subjectId}
        subjects={[{ id: subjectId, label: "MATH 121 · Quantitative reasoning", termId }]}
        terms={[{ id: termId, label: "Fall 2026" }]}
      />,
    );

    expect(screen.getByText("Submit weighted reflection")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Complete Submit weighted reflection" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy AI starter prompt" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Open task workspace" }).getAttribute("href")).toBe(`/planner?task=${weightedTask.id}`);
  });
});
