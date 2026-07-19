"use client";

import { useState } from "react";

import type { TaskView } from "@/lib/sync/types";

type AssignmentPromptTask = Pick<
  TaskView,
  "title" | "dueAt" | "description" | "links"
>;
type ClipboardWriter = Pick<Clipboard, "writeText">;

function localDueDate(dueAt: string): string {
  return new Date(dueAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function buildAssignmentStarterPrompt(
  task: AssignmentPromptTask,
  subjectLabel: string,
  approvedCategoryLabels: string[],
): string {
  const assessmentContext = approvedCategoryLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .join(", ");
  return [
    "Help me start this assignment without writing it for me.",
    `Assignment: ${task.title}`,
    `Course: ${subjectLabel || "Not assigned"}`,
    assessmentContext ? `Assessment context: ${assessmentContext}` : null,
    task.dueAt ? `Due: ${localDueDate(task.dueAt)}` : null,
    task.description.trim() ? `Brief: ${task.description.trim()}` : null,
    task.links[0] ? `Reference: ${task.links[0]}` : null,
    "First, ask up to three clarifying questions. Then give me a small outline, a 25-minute first step, and a checklist I can complete myself.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export async function copyAssignmentStarterPrompt(
  prompt: string,
  clipboard: ClipboardWriter,
): Promise<void> {
  await clipboard.writeText(prompt);
}

export function AssignmentPrompt({
  task,
  subjectLabel,
  approvedCategoryLabels,
  clipboard,
}: {
  task: AssignmentPromptTask;
  subjectLabel: string;
  approvedCategoryLabels: string[];
  clipboard?: ClipboardWriter | null;
}) {
  const [status, setStatus] = useState("");

  async function copyPrompt() {
    const clipboardWriter = clipboard ?? (typeof navigator === "undefined" ? null : navigator.clipboard);
    if (!clipboardWriter?.writeText) {
      setStatus("Copy is unavailable in this browser. Select and copy the assignment details manually.");
      return;
    }

    try {
      await copyAssignmentStarterPrompt(
        buildAssignmentStarterPrompt(task, subjectLabel, approvedCategoryLabels),
        clipboardWriter,
      );
      setStatus("AI starter prompt copied. Paste it into the AI tool you choose.");
    } catch {
      setStatus("Could not copy the AI starter prompt. Please try again.");
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button
        className="inline-flex min-h-11 items-center rounded-xl border border-teal px-3 py-2 text-sm font-bold text-teal hover:bg-[#e6f2f0]"
        onClick={() => void copyPrompt()}
        type="button"
      >
        Copy AI starter prompt
      </button>
      {status ? (
        <p className="text-xs text-slate-600" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
