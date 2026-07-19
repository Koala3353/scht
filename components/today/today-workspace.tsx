"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Cloud, Plus } from "lucide-react";

import { Agenda, selectAgendaTasks } from "@/components/today/agenda";
import { FocusCard, chooseFocusTask } from "@/components/today/focus-card";
import { taskDb } from "@/lib/sync/db";
import { enqueueTaskMutation, flushTaskOutbox } from "@/lib/sync/outbox";
import type {
  CachedTask,
  TaskMutation,
  TaskSyncResponse,
} from "@/lib/sync/types";

type SyncState = "Offline" | "Syncing" | "Synced" | "Needs review";

interface TodayWorkspaceProps {
  initialTasks: CachedTask[];
  selectedTermId: string | null;
}

async function postTaskMutations(
  mutations: TaskMutation[],
): Promise<TaskSyncResponse> {
  const response = await fetch("/api/sync/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!response.ok) throw new Error("Task sync failed.");
  return response.json() as Promise<TaskSyncResponse>;
}

function newTaskId() {
  return crypto.randomUUID();
}

function syncTone(state: SyncState) {
  if (state === "Synced") return "bg-[#e6f2f0] text-teal";
  if (state === "Syncing") return "bg-[#e8eef9] text-[#345d9d]";
  return "bg-[#f7ebe3] text-action";
}

export function TodayWorkspace({
  initialTasks,
  selectedTermId,
}: TodayWorkspaceProps) {
  const [tasks, setTasks] = useState<CachedTask[]>(initialTasks);
  const [syncState, setSyncState] = useState<SyncState>("Synced");
  const [title, setTitle] = useState("");
  const agendaTasks = useMemo(
    () => (selectedTermId ? selectAgendaTasks(tasks, selectedTermId) : []),
    [selectedTermId, tasks],
  );

  async function refreshTasks() {
    if (!selectedTermId) return;
    setTasks(
      await taskDb.tasks.where("termId").equals(selectedTermId).toArray(),
    );
  }

  async function synchronize() {
    if (!navigator.onLine) {
      setSyncState("Offline");
      return;
    }
    setSyncState("Syncing");
    try {
      const response = await flushTaskOutbox(postTaskMutations);
      setSyncState(response.rejected.length > 0 ? "Needs review" : "Synced");
    } catch {
      setSyncState("Offline");
    }
  }

  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (initialTasks.length > 0) await taskDb.tasks.bulkPut(initialTasks);
      if (active) await refreshTasks();
      if (active) await synchronize();
    }
    void hydrate();
    const handleOnline = () => void synchronize();
    const handleOffline = () => setSyncState("Offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // The server snapshot is a hydration boundary; local changes remain authoritative after it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermId]);

  async function saveTask(task: CachedTask) {
    await taskDb.tasks.put(task);
    await enqueueTaskMutation({
      id: newTaskId(),
      operation: "upsert",
      payload: task,
    });
    await refreshTasks();
    await synchronize();
  }

  async function completeTask(task: CachedTask) {
    const updatedAt = new Date().toISOString();
    await saveTask({ ...task, completedAt: updatedAt, updatedAt });
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedTermId) return;
    const now = new Date().toISOString();
    await saveTask({
      id: newTaskId(),
      title: trimmedTitle,
      kind: "school",
      priority: "normal",
      termId: selectedTermId,
      dueAt: null,
      subjectId: null,
      weightPercent: null,
      completedAt: null,
      updatedAt: now,
    });
    setTitle("");
  }

  if (!selectedTermId) {
    return (
      <main className="max-w-2xl">
        <section className="rounded-[1.75rem] border border-teal/20 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold text-teal">Your workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">
            Set your current term first.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-700">
            Complete onboarding to bring your classes, due work, and study plan
            into one useful view.
          </p>
          <a
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal px-4 py-2 font-bold text-white transition hover:bg-[#064c4e]"
            href="/onboarding"
          >
            Set up your term <ArrowRight className="size-4" />
          </a>
        </section>
      </main>
    );
  }

  const focusTask = chooseFocusTask(agendaTasks);
  const completedCount = tasks.filter(
    (task) => task.termId === selectedTermId && task.completedAt,
  ).length;

  return (
    <main className="pb-8">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-teal">Today</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-wrap-balance sm:text-4xl">
            Make the next hour count.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-700">
            Your current term is filtered down to the work that deserves your
            attention now.
          </p>
        </div>
        <p
          aria-live="polite"
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${syncTone(syncState)}`}
        >
          <Cloud className="size-4" aria-hidden="true" />
          {syncState}
        </p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.8fr)]">
        <FocusCard task={focusTask} />
        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-teal">Quick capture</p>
          <h2 className="mt-2 text-xl font-black tracking-tight">
            Keep the small things visible.
          </h2>
          <form className="mt-5 space-y-3" onSubmit={addTask}>
            <label className="sr-only" htmlFor="new-task-title">
              New task title
            </label>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink placeholder:text-slate-600 focus:border-teal"
              id="new-task-title"
              maxLength={180}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a task for this term"
              value={title}
            />
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-action px-4 py-2 font-bold text-white transition hover:bg-[#8d3909] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!title.trim()}
              type="submit"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add task
            </button>
          </form>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <CheckCircle2 className="size-4 text-teal" aria-hidden="true" />
              {completedCount} completed this term
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
              href="/planner"
            >
              See all open tasks <ArrowRight className="size-4" />
            </a>
          </div>
        </aside>
      </div>

      <section className="mt-9 max-w-4xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal">Agenda</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              Your open work
            </h2>
          </div>
          <a
            className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
            href="/calendar"
          >
            Open calendar <ArrowRight className="size-4" />
          </a>
        </div>
        <Agenda tasks={agendaTasks} onComplete={completeTask} />
      </section>
    </main>
  );
}
