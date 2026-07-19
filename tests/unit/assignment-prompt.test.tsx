import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssignmentPrompt, buildAssignmentStarterPrompt, copyAssignmentStarterPrompt } from "../../components/ai/assignment-prompt";
import type { TaskView } from "../../lib/sync/types";

const task: TaskView = {
  id: "assignment-1",
  title: "Analysis essay",
  kind: "school",
  dueAt: "2026-07-24T09:30:00.000Z",
  priority: "normal",
  termId: "term-1",
  subjectId: "subject-1",
  projectId: null,
  weightPercent: 25,
  description: "Compare two primary sources.",
  links: ["https://canvas.example.edu/assignments/42"],
  effortMinutes: null,
  completedAt: null,
  updatedAt: "2026-07-19T10:00:00.000Z",
  source: "canvas",
  sourceId: "canvas-42",
};

afterEach(cleanup);

describe("assignment starter prompt", () => {
  it("copies source-backed task context and asks for an outline, not a submission", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<AssignmentPrompt approvedCategoryLabels={["Essays", "Participation"]} subjectLabel="HIST 101 · History" task={task} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Copy AI starter prompt" }));

    await copyAssignmentStarterPrompt(buildAssignmentStarterPrompt(task, "HIST 101 · History", ["Essays", "Participation"]), { writeText });
    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0]?.[0] ?? "";
    expect(copied).toContain("Assignment: Analysis essay");
    expect(copied).toContain("Course: HIST 101 · History");
    expect(copied).toContain("Due: ");
    expect(copied).toContain("Brief: Compare two primary sources.");
    expect(copied).toContain("Reference: https://canvas.example.edu/assignments/42");
    expect(copied).toContain("give me a small outline");
    expect(copied).toContain("without writing it for me");
    expect(copied).not.toMatch(/vault|ciphertext|api[_ -]?key|secret/i);
    expect(screen.getByRole("status").textContent).toContain("copied");
  });

  it("keeps an undated, brief-less task compact and useful", () => {
    const prompt = buildAssignmentStarterPrompt({ ...task, dueAt: null, description: "", links: [] }, "HIST 101 · History", []);
    expect(prompt).toContain("Assignment: Analysis essay");
    expect(prompt).toContain("Course: HIST 101 · History");
    expect(prompt).not.toContain("Due:");
    expect(prompt).not.toContain("Brief:");
    expect(prompt).not.toContain("Reference:");
    expect(prompt).toContain("25-minute first step");
  });
});
