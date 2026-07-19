"use client";

import { useMemo, useState } from "react";
import { FilterX, ListFilter } from "lucide-react";

import { TaskList } from "@/components/tasks/task-list";
import { sourceLabel, type TaskProject, type TaskSubject, type TaskTerm } from "@/components/tasks/task-editor";
import { WorkManager } from "@/components/work/work-manager";
import type { CachedTask, TaskSyncResponse } from "@/lib/sync/types";

export type PlannerTask = CachedTask;

type PlannerWorkspaceProps = {
  tasks: PlannerTask[];
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
};

export function PlannerWorkspace({ tasks: initialTasks, currentTermId, terms, subjects, projects }: PlannerWorkspaceProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [subject, setSubject] = useState("all");
  const [project, setProject] = useState("all");
  const [term, setTerm] = useState(currentTermId ?? "all");
  const [status, setStatus] = useState("open");
  const sources = useMemo(() => [...new Set(tasks.map((task) => task.source))].sort(), [tasks]);
  const visible = tasks.filter((task) =>
    (source === "all" || task.source === source) &&
    (priority === "all" || task.priority === priority) &&
    (subject === "all" || task.subjectId === subject) &&
    (project === "all" || task.projectId === project) &&
    (term === "all" || task.termId === term) &&
    (status === "all" || (status === "completed" ? Boolean(task.completedAt) : !task.completedAt)),
  );
  const filtered = [source, priority, subject, project, term, status].some((value, index) => value !== (index === 4 ? (currentTermId ?? "all") : index === 5 ? "open" : "all"));

  async function saveTask(task: CachedTask, baseUpdatedAt: string | null) {
    setTasks((current) => current.map((candidate) => candidate.id === task.id ? { ...task, syncState: "pending" } : candidate));
    const response = await fetch("/api/sync/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mutations: [{ id: crypto.randomUUID(), userId: task.userId, operation: "upsert", payload: task, baseUpdatedAt }] }),
    });
    if (!response.ok) return;
    const result = await response.json() as TaskSyncResponse;
    const accepted = result.accepted[0]?.task;
    if (accepted) setTasks((current) => current.map((candidate) => candidate.id === accepted.id ? { ...accepted, userId: task.userId, syncState: "synced" } : candidate));
  }

  function clearFilters() {
    setSource("all"); setPriority("all"); setSubject("all"); setProject("all"); setTerm(currentTermId ?? "all"); setStatus("open");
  }

  return <section className="mx-auto mt-6 max-w-5xl px-4 sm:px-0">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ListFilter className="size-4 text-teal" aria-hidden="true" /><h2 className="font-bold text-ink">Filter tasks</h2></div><p className="text-sm text-slate-600">{visible.length} of {tasks.length} tasks</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold text-ink">Term<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={term} onChange={(event) => setTerm(event.target.value)}><option value="all">All terms</option>{terms.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Source<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{sources.map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Subject<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.filter((value) => term === "all" || value.termId === term).map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Project<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All projects</option>{projects.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">Priority<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
        <label className="text-sm font-semibold text-ink">Status<select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="completed">Completed</option><option value="all">All statuses</option></select></label>
      </div>
      {filtered && <button className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-teal hover:bg-[#e6f2f0]" type="button" onClick={clearFilters}><FilterX className="size-4" aria-hidden="true" />Clear filters</button>}
    </div>
    <div className="mt-5"><TaskList currentTermId={currentTermId} onSave={saveTask} projects={projects} subjects={subjects} tasks={visible} terms={terms} /></div>
    <div className="mt-8"><WorkManager initialProjects={projects.map((item) => ({ id: item.id, name: item.label, status: item.status }))} tasks={tasks.filter((task) => !task.completedAt).map((task) => ({ id: task.id, title: task.title, projectId: task.projectId ?? null, dueAt: task.dueAt ?? null }))} /></div>
  </section>;
}
