"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Cloud } from "lucide-react";

import { selectAgendaTasks } from "./agenda";
import { FocusCard, chooseFocusTask } from "./focus-card";
import { DailyBriefing } from "./daily-briefing";
import { TaskEditor, type TaskProject, type TaskSubject, type TaskTerm } from "../tasks/task-editor";
import { TaskList } from "../tasks/task-list";
import { useTaskSyncWorkspace } from "../tasks/use-task-sync-workspace";
import type { CachedTask } from "../../lib/sync/types";

type SyncState = "Offline" | "Syncing" | "Synced" | "Sync failed";

interface TodayWorkspaceProps {
  initialTasks: CachedTask[];
  selectedTermId: string | null;
  userId: string;
  terms?: TaskTerm[];
  subjects?: TaskSubject[];
  projects?: TaskProject[];
  hiddenSubjectIds?: string[];
  headerAction?: ReactNode;
  changes?: Array<{ id: string; summary: string; createdAt: string; changeKind: string }>;
  events?: Array<{ id: string; title: string; startsAt: string | null }>;
}

function syncTone(state: SyncState) {
  if (state === "Synced") return "bg-[#e6f2f0] text-teal";
  if (state === "Syncing") return "bg-[#e8eef9] text-[#345d9d]";
  return "bg-[#f7ebe3] text-action";
}

function syncLabel(state: SyncState) {
  if (state === "Syncing") return "Saving to Supabase";
  if (state === "Synced") return "Changes saved to Supabase";
  if (state === "Offline") return "Reconnect to save changes";
  return "Task save failed";
}

export function TodayWorkspace({
  initialTasks,
  selectedTermId,
  userId,
  terms = [],
  subjects = [],
  projects = [],
  hiddenSubjectIds = [],
  headerAction,
  changes = [],
  events = [],
}: TodayWorkspaceProps) {
  const hiddenSubjectIdSet = useMemo(() => new Set(hiddenSubjectIds), [hiddenSubjectIds]);
  const filteredInitialTasks = useMemo(
    () => initialTasks.filter((task) => (!selectedTermId || task.termId === selectedTermId) && (!task.subjectId || !hiddenSubjectIdSet.has(task.subjectId))),
    [hiddenSubjectIdSet, initialTasks, selectedTermId],
  );
  const { tasks, saveTask: persistTask, syncState } = useTaskSyncWorkspace({ userId, initialTasks: filteredInitialTasks });
  const [lastFailedSave, setLastFailedSave] = useState<{ task: CachedTask; baseUpdatedAt: string | null; message: string } | null>(null);

  const newManualTask = (): CachedTask => ({
    id: crypto.randomUUID(), userId, title: "New task", kind: "school", priority: "normal", termId: null, dueAt: null,
    subjectId: null, projectId: null, weightPercent: null, description: "", links: [], effortMinutes: null,
    completedAt: null, updatedAt: new Date().toISOString(), syncState: "synced", source: "manual", sourceId: null,
  });
  const [quickCaptureTask, setQuickCaptureTask] = useState<CachedTask>(newManualTask);

  async function saveTask(task: CachedTask, baseUpdatedAt: string | null) {
    try {
      await persistTask(task, baseUpdatedAt);
      setLastFailedSave(null);
    } catch (error) {
      setLastFailedSave({ task, baseUpdatedAt, message: error instanceof Error ? error.message : "Task could not be saved." });
      throw error;
    }
  }

  async function saveQuickCapture(task: CachedTask, baseUpdatedAt: string | null) {
    await saveTask(task, baseUpdatedAt);
    setQuickCaptureTask(newManualTask());
  }

  if (!selectedTermId) return <main className="max-w-2xl"><section className="rounded-[1.75rem] border border-teal/20 bg-white p-7 shadow-sm sm:p-9"><p className="text-sm font-semibold text-teal">Your workspace</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Set your current term first.</h1><p className="mt-3 max-w-xl leading-7 text-slate-700">Complete onboarding to bring your classes, due work, and study plan into one useful view.</p><a className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal px-4 py-2 font-bold text-white transition hover:bg-[#064c4e]" href="/onboarding">Set up your term <ArrowRight className="size-4" /></a></section></main>;

  const agendaTasks = selectAgendaTasks(tasks, selectedTermId);
  const focusTask = chooseFocusTask(agendaTasks);
  const completedCount = tasks.filter((task) => task.termId === selectedTermId && task.completedAt).length;

  return <main className="pb-8">
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-7 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl"><p className="text-sm font-semibold text-teal">Today</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-wrap-balance sm:text-4xl">Make the next hour count.</h1><p className="mt-3 max-w-xl leading-7 text-slate-700">Your current term is filtered down to the work that deserves your attention now.</p></div>
      <div className="flex flex-wrap items-center gap-3 xl:justify-end">{headerAction}<p aria-live="polite" className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${syncTone(syncState)}`}><Cloud className="size-4" aria-hidden="true" />{syncLabel(syncState)}</p></div>
    </header>
    {lastFailedSave ? <section className="mt-5 rounded-xl border border-action/30 bg-[#fff8f3] p-4 text-sm text-slate-700" role="status"><p className="font-semibold text-action">{lastFailedSave.message}</p><p className="mt-1">No task was stored locally. Reconnect and retry to save it to Supabase.</p><button className="mt-3 min-h-11 rounded-xl border border-action px-4 py-2 font-bold text-action" onClick={() => void saveTask(lastFailedSave.task, lastFailedSave.baseUpdatedAt)} type="button">Retry save</button></section> : null}
    <div className="mt-7 space-y-5"><DailyBriefing changes={changes} events={events} focusTask={focusTask} tasks={agendaTasks} /><FocusCard task={focusTask} />
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-teal">Quick capture</p><h2 className="mt-2 text-xl font-black tracking-tight">Keep the small things visible.</h2></div><p className="max-w-xl text-sm leading-6 text-slate-600">Saved directly to your Scht workspace.</p></div><div className="mt-5"><TaskEditor baseUpdatedAt={null} currentTermId={selectedTermId} defaultToCurrentTerm embedded key={quickCaptureTask.id} onSave={saveQuickCapture} projects={projects} subjects={subjects} task={quickCaptureTask} terms={terms} /></div><div className="mt-6 border-t border-slate-100 pt-5"><p className="flex items-center gap-2 text-sm font-bold text-ink"><CheckCircle2 className="size-4 text-teal" aria-hidden="true" />{completedCount} completed this term</p><a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal" href="/planner">See all open tasks <ArrowRight className="size-4" /></a></div></section>
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-teal">Current term</p><h2 className="mt-1 text-xl font-black tracking-tight">Work to do next.</h2></div><a className="text-sm font-bold text-teal underline" href="/planner">Open planner</a></div><div className="mt-5"><TaskList currentTermId={selectedTermId} onSave={saveTask} projects={projects} subjects={subjects} tasks={agendaTasks} terms={terms} /></div></section>
    </div>
  </main>;
}
