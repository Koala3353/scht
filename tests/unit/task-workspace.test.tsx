import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskEditor } from "../../components/tasks/task-editor";
import { TaskList, relativeDue } from "../../components/tasks/task-list";
import type { CachedTask } from "../../lib/sync/types";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";
const subjectId = "451f818e-93c7-4b02-82d1-712acdf8183a";
const projectId = "7b95f593-b58f-4550-a0ba-4c824e7e343a";

function task(overrides: Partial<CachedTask> = {}): CachedTask {
  return {
    id: "f11c73a2-24b7-40ee-88fd-d7bf9a203420",
    userId,
    title: "Draft task",
    kind: "school",
    dueAt: null,
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
    ...overrides,
  };
}

const context = {
  terms: [{ id: termId, label: "Fall 2026" }],
  subjects: [{ id: subjectId, termId, label: "MATH 121 · Quantitative reasoning" }],
  projects: [{ id: projectId, label: "Capstone", status: "active" as const }],
};

afterEach(cleanup);

describe("shared task workspace", () => {
  it("captures the complete task record from labelled controls", async () => {
    const onSave = vi.fn();
    render(<TaskEditor {...context} currentTermId={termId} defaultToCurrentTerm onSave={onSave} task={task({ termId: null })} />);
    const user = userEvent.setup();

    expect(screen.getByRole("option", { name: "MATH 121 · Quantitative reasoning" })).not.toBeNull();
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Submit field report");
    await user.click(screen.getByLabelText("No deadline"));
    await user.type(screen.getByLabelText("Due date and time"), "2026-07-22T09:15");
    await user.type(screen.getByLabelText("Description"), "Include observations.");
    await user.selectOptions(screen.getByLabelText("Type"), "personal");
    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    await user.clear(screen.getByLabelText("Effort (minutes)"));
    await user.type(screen.getByLabelText("Effort (minutes)"), "45");
    await user.selectOptions(screen.getByLabelText("Subject"), subjectId);
    await user.selectOptions(screen.getByLabelText("Project"), projectId);
    await user.clear(screen.getByLabelText("Grade impact (%)"));
    await user.type(screen.getByLabelText("Grade impact (%)"), "20");
    await user.type(screen.getByLabelText("Links (one per line)"), "https://canvas.example.edu/assignments/1");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Submit field report",
      dueAt: new Date("2026-07-22T09:15").toISOString(),
      description: "Include observations.",
      kind: "personal",
      priority: "high",
      effortMinutes: 45,
      termId,
      subjectId,
      projectId,
      weightPercent: 20,
      links: ["https://canvas.example.edu/assignments/1"],
    }), "2026-07-19T10:00:00.000Z");
  });

  it("executes imported Canvas tasks while retaining their context", async () => {
    const onSave = vi.fn();
    render(<TaskList {...context} onSave={onSave} tasks={[task({
      title: "Canvas assignment",
      source: "canvas",
      sourceId: "canvas-42",
      description: "Read chapters 3 and 4.",
      links: ["https://canvas.example.edu/courses/1/assignments/42"],
      dueAt: "2026-07-20T09:30:00.000Z",
      subjectId,
    })]} />);
    const user = userEvent.setup();

    expect(screen.getByText("Canvas")).not.toBeNull();
    expect(screen.getByText("Read chapters 3 and 4.")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Open source link" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Complete Canvas assignment" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ completedAt: expect.any(String) }), "2026-07-19T10:00:00.000Z");
    await user.click(screen.getByRole("button", { name: "Edit Canvas assignment" }));
    expect(screen.getByLabelText("Description")).not.toBeNull();
    expect(screen.getByText(/Imported from Canvas/)).not.toBeNull();
    await user.clear(screen.getByLabelText("Due date and time"));
    await user.type(screen.getByLabelText("Due date and time"), "2026-07-23T13:45");
    await user.click(screen.getByRole("button", { name: "Save task" }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
      dueAt: new Date("2026-07-23T13:45").toISOString(),
      source: "canvas",
      sourceId: "canvas-42",
    }), "2026-07-19T10:00:00.000Z");
  });

  it("uses calendar days for relative due labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));

    expect(relativeDue("2026-07-20T12:00:00.000Z")).toContain("Tomorrow");
    vi.useRealTimers();
  });

  it("preserves an explicit No term selection when a current term is available", async () => {
    const onSave = vi.fn();
    render(<TaskEditor {...context} currentTermId={termId} defaultToCurrentTerm onSave={onSave} task={task({ termId: null })} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Term"), "");
    expect((screen.getByLabelText("Term") as HTMLSelectElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ termId: null, subjectId: null }), "2026-07-19T10:00:00.000Z");
  });
});
