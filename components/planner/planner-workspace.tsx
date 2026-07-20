"use client";

import { useMemo, useState } from "react";
import { FilterX, ListFilter } from "lucide-react";

import { TaskList } from "../tasks/task-list";
import { sourceLabel, type TaskProject, type TaskSubject, type TaskTerm } from "../tasks/task-editor";
import { useTaskSyncWorkspace } from "../tasks/use-task-sync-workspace";
import { WorkManager } from "../work/work-manager";
import type { CachedTask } from "../../lib/sync/types";

export type PlannerTask = CachedTask;

type PlannerWorkspaceProps = {
  tasks: PlannerTask[];
  userId: string;
  currentTermId: string | null;
  terms: TaskTerm[];
  subjects: TaskSubject[];
  projects: TaskProject[];
  hiddenSubjectIds?: string[];
  focusedTaskId?: string | null;
  approvedCategoryLabelsBySubject?: Record<string, string[]>;
};

type SaveFailure = {
  task: CachedTask;
  baseUpdatedAt: string | null;
  reason: string;
};

export function PlannerWorkspace({ tasks: initialTasks, userId, currentTermId, terms, subjects, projects, hiddenSubjectIds = [], focusedTaskId = null, approvedCategoryLabelsBySubject = {} }: PlannerWorkspaceProps) {
  const { tasks, saveTask: saveLocalTask, syncState } = useTaskSyncWorkspace({
    userId,
    initialTasks,
    currentTermId,
    filterTasks: (cachedTasks) => cachedTasks.filter((task) => !task.subjectId || !hiddenSubjectIds.includes(task.subjectId)),
  });
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [subject, setSubject] = useState("all");
  const [project, setProject] = useState("all");
  const [term, setTerm] = useState(focusedTaskId ? "all" : currentTermId ?? "all");
  const [status, setStatus] = useState(focusedTaskId ? "all" : "open");
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
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
    try {
      await saveLocalTask(task, baseUpdatedAt);
      setSaveFailure(null);
    } catch (error) {
      setSaveFailure({ task, baseUpdatedAt, reason: error instanceof Error ? error.message : "Task could not be saved." });
    }
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
    <div className="mt-5"><TaskList approvedCategoryLabelsBySubject={approvedCategoryLabelsBySubject} currentTermId={currentTermId} initialEditingId={focusedTaskId} onSave={saveTask} projects={projects} subjects={subjects} tasks={visible} terms={terms} /></div>
    {(saveFailure || syncState === "Sync failed" || syncState === "Offline") && <section className="mt-5 rounded-xl border border-action/30 bg-[#fff8f3] p-4 text-sm text-slate-700" role="status"><p className="font-semibold text-action">{saveFailure?.reason ?? "Reconnect to save task changes to Supabase."}</p>{saveFailure ? <div className="mt-3"><button className="min-h-11 rounded-xl border border-action px-4 py-2 font-bold text-action" onClick={() => void saveTask(saveFailure.task, saveFailure.baseUpdatedAt)} type="button">Retry save</button></div> : null}</section>}
    <div className="mt-8"><WorkManager initialProjects={projects.map((item) => ({ id: item.id, name: item.label, status: item.status }))} onSaveTask={saveTask} tasks={tasks.filter((task) => !task.completedAt)} /></div>
  </section>;
}
