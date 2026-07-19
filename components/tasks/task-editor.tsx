"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { CachedTask } from "@/lib/sync/types";

export type TaskTerm = { id: string; label: string };
export type TaskSubject = { id: string; termId: string; label: string };
export type TaskProject = { id: string; label: string; status: "active" | "archived" };

export type TaskEditorProps = {
  task: CachedTask;
  currentTermId?: string | null;
  /** Only fresh manual capture should inherit the selected current term. */
  defaultToCurrentTerm?: boolean;
  /** `null` identifies a fresh task that must be created rather than conditionally updated. */
  baseUpdatedAt?: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  onSave: (task: CachedTask, baseUpdatedAt: string | null) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

function asLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function nullable(value: string) {
  return value.trim() || null;
}

export function TaskEditor({
  task,
  currentTermId = null,
  defaultToCurrentTerm = false,
  baseUpdatedAt,
  terms,
  subjects,
  projects,
  onSave,
  onCancel,
  submitLabel = "Save task",
}: TaskEditorProps) {
  const [draft, setDraft] = useState(task);
  const [usesCurrentTermDefault, setUsesCurrentTermDefault] = useState(
    () => defaultToCurrentTerm && task.termId === null && currentTermId !== null,
  );
  const [noDeadline, setNoDeadline] = useState(!task.dueAt);
  const [linksText, setLinksText] = useState(task.links.join("\n"));
  const [saving, setSaving] = useState(false);

  const selectedTermId = usesCurrentTermDefault ? currentTermId : draft.termId;
  const visibleSubjects = useMemo(
    () => subjects.filter((subject) => subject.termId === selectedTermId),
    [selectedTermId, subjects],
  );
  const activeProjects = projects.filter((project) => project.status === "active" || project.id === draft.projectId);

  function update<K extends keyof CachedTask>(key: K, value: CachedTask[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const links = linksText.split("\n").map((link) => link.trim()).filter(Boolean);
    const dueAt = noDeadline || !draft.dueAt ? null : new Date(draft.dueAt).toISOString();
    const nextTask: CachedTask = {
      ...draft,
      termId: selectedTermId,
      title: draft.title.trim(),
      dueAt,
      description: draft.description.trim(),
      links,
      updatedAt: new Date().toISOString(),
    };
    if (!nextTask.title) return;
    setSaving(true);
    try {
      await onSave(nextTask, baseUpdatedAt === undefined ? task.updatedAt ?? null : baseUpdatedAt);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-5" onSubmit={submit}>
      {task.source !== "manual" && (
        <p className="sm:col-span-2 text-sm font-semibold text-slate-600">Imported from {sourceLabel(task.source)}. Source identity is read-only.</p>
      )}
      <label className="grid gap-1 text-sm font-bold text-ink sm:col-span-2" htmlFor="task-title">
        Title
        <input className="rounded-xl border border-slate-300 px-3 py-2 text-ink" id="task-title" maxLength={180} onChange={(event) => update("title", event.target.value)} required value={draft.title} />
      </label>
      <div className="sm:col-span-2">
        <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-due-at">
          Due date and time
          <input className="rounded-xl border border-slate-300 px-3 py-2 text-ink disabled:bg-slate-100" disabled={noDeadline} id="task-due-at" onChange={(event) => update("dueAt", event.target.value ? new Date(event.target.value).toISOString() : null)} type="datetime-local" value={asLocalDateTime(draft.dueAt)} />
        </label>
        <label className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input checked={noDeadline} onChange={(event) => { setNoDeadline(event.target.checked); if (event.target.checked) update("dueAt", null); }} type="checkbox" />
          No deadline
        </label>
      </div>
      <label className="grid gap-1 text-sm font-bold text-ink sm:col-span-2" htmlFor="task-description">
        Description
        <textarea className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-ink" id="task-description" maxLength={5000} onChange={(event) => update("description", event.target.value)} value={draft.description} />
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-kind">
        Type
        <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" id="task-kind" onChange={(event) => update("kind", event.target.value as CachedTask["kind"])} value={draft.kind}><option value="school">School</option><option value="personal">Personal</option><option value="work">Work</option></select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-priority">
        Priority
        <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" id="task-priority" onChange={(event) => update("priority", event.target.value as CachedTask["priority"])} value={draft.priority}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-effort">
        Effort (minutes)
        <input className="rounded-xl border border-slate-300 px-3 py-2" id="task-effort" max={1440} min={1} onChange={(event) => update("effortMinutes", event.target.value ? Number(event.target.value) : null)} type="number" value={draft.effortMinutes ?? ""} />
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-weight">
        Grade impact (%)
        <input className="rounded-xl border border-slate-300 px-3 py-2" id="task-weight" max={100} min={0} onChange={(event) => update("weightPercent", event.target.value ? Number(event.target.value) : null)} step="0.1" type="number" value={draft.weightPercent ?? ""} />
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-term">
        Term
        <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" id="task-term" onChange={(event) => { const termId = nullable(event.target.value); setUsesCurrentTermDefault(false); update("termId", termId); if (!subjects.some((subject) => subject.id === draft.subjectId && subject.termId === termId)) update("subjectId", null); }} value={selectedTermId ?? ""}><option value="">No term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-subject">
        Subject
        <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" id="task-subject" onChange={(event) => update("subjectId", nullable(event.target.value))} value={draft.subjectId ?? ""}><option value="">No subject</option>{visibleSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink" htmlFor="task-project">
        Project
        <select className="rounded-xl border border-slate-300 bg-white px-3 py-2" id="task-project" onChange={(event) => update("projectId", nullable(event.target.value))} value={draft.projectId ?? ""}><option value="">No project</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-ink sm:col-span-2" htmlFor="task-links">
        Links (one per line)
        <textarea className="min-h-20 rounded-xl border border-slate-300 px-3 py-2" id="task-links" maxLength={12000} onChange={(event) => setLinksText(event.target.value)} value={linksText} />
      </label>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={saving || !draft.title.trim()} type="submit">{submitLabel}</button>
        {onCancel && <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={onCancel} type="button">Cancel</button>}
      </div>
    </form>
  );
}

export function sourceLabel(source: string) {
  if (source === "google_calendar") return "Google Calendar";
  if (source === "gmail") return "Gmail";
  if (source === "canvas") return "Canvas";
  if (source === "ai") return "AI";
  if (source === "manual") return "Manual";
  return source;
}
