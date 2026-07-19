"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Cloud, Plus } from "lucide-react";

import { Agenda, selectAgendaTasks } from "./agenda";
import { FocusCard, chooseFocusTask } from "./focus-card";
import { mergeTaskSnapshot, shouldApplyAcceptedTask } from "../tasks/task-types";
import { taskDb } from "../../lib/sync/db";
import { discardTaskConflict, enqueueTaskMutation, flushTaskOutbox, resolveTaskConflict, retryRejectedTaskMutation, retryTaskOutbox } from "../../lib/sync/outbox";
import type {
  CachedTask,
  TaskMutation,
  TaskSyncResponse,
} from "../../lib/sync/types";

type SyncState = "Offline" | "Syncing" | "Synced" | "Needs review" | "Sync failed";

interface TodayWorkspaceProps {
  initialTasks: CachedTask[];
  selectedTermId: string | null;
  userId: string;
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

function retryDelayUntil(nextRetryAt: number) {
  return Math.max(0, nextRetryAt - Date.now());
}

function syncTone(state: SyncState) {
  if (state === "Synced") return "bg-[#e6f2f0] text-teal";
  if (state === "Syncing") return "bg-[#e8eef9] text-[#345d9d]";
  return "bg-[#f7ebe3] text-action";
}

export function TodayWorkspace({
  initialTasks,
  selectedTermId,
  userId,
}: TodayWorkspaceProps) {
  const [tasks, setTasks] = useState<CachedTask[]>(initialTasks);
  const [syncState, setSyncState] = useState<SyncState>("Synced");
  const [title, setTitle] = useState("");
  const [reviewConfirmation, setReviewConfirmation] = useState<string | null>(null);
  const retryTimer = useRef<number | undefined>(undefined);
  const agendaTasks = useMemo(
    () => (selectedTermId ? selectAgendaTasks(tasks, selectedTermId) : []),
    [selectedTermId, tasks],
  );

  async function refreshTasks() {
    const cachedTasks = await taskDb.tasks.where("userId").equals(userId).toArray();
    const visibleTasks = selectedTermId ? cachedTasks.filter((task) => task.termId === selectedTermId) : cachedTasks;
    setTasks(visibleTasks);
    return visibleTasks;
  }

  function scheduleRetry(nextRetryAt?: number) {
    if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
    if (!nextRetryAt || !navigator.onLine) return;
    retryTimer.current = window.setTimeout(() => void synchronize(), retryDelayUntil(nextRetryAt));
  }

  async function synchronize() {
    if (!navigator.onLine) {
      setSyncState("Offline");
      return;
    }
    setSyncState("Syncing");
    try {
      const response = await flushTaskOutbox(userId, postTaskMutations);
      await taskDb.transaction("rw", taskDb.tasks, async () => {
        const pendingMutations = (await taskDb.outbox.where("userId").equals(userId).toArray())
          .filter((mutation) => mutation.syncState === "pending");
        await Promise.all(
          response.accepted.map(async ({ task }) => {
            const localTask = await taskDb.tasks.get(task.id);
            if (shouldApplyAcceptedTask(localTask, task, pendingMutations)) {
              await taskDb.tasks.put({ ...task, userId, syncState: "synced" });
            }
          }),
        );
        await Promise.all(
          response.rejected.map(async ({ id, taskId, task: canonicalTask, reason, syncState: rejectedState }) => {
            // Sync responses identify a mutation; the task cache is keyed by task id.
            const mutation = await taskDb.outbox.get(id);
            const affectedTaskId = taskId ?? mutation?.payload.id;
            if (!affectedTaskId) return;
            const localTask = await taskDb.tasks.get(affectedTaskId);
            if (localTask?.userId === userId) {
              await taskDb.tasks.update(affectedTaskId, {
                syncState: rejectedState,
                syncError: reason,
                ...(canonicalTask ? { canonicalTask } : {}),
              });
            }
          }),
        );
      });
      const refreshedTasks = await refreshTasks();
      scheduleRetry(response.nextRetryAt);
      setSyncState(
        response.networkError
          ? "Sync failed"
          : refreshedTasks.some((task) => task.syncState === "conflict" || task.syncState === "rejected")
            ? "Needs review"
            : "Synced",
      );
    } catch {
      setSyncState("Sync failed");
    }
  }

  async function retrySynchronization() {
    await retryTaskOutbox(userId);
    await synchronize();
  }

  async function reviewMutation(task: CachedTask, state: 'conflict' | 'rejected') {
    return (await taskDb.outbox.where('userId').equals(userId).toArray())
      .find((mutation) => mutation.payload.id === task.id && mutation.syncState === state);
  }

  async function keepLocalConflict(task: CachedTask) {
    const mutation = await reviewMutation(task, 'conflict');
    if (!mutation) return;
    await resolveTaskConflict(userId, mutation.id, task);
    await taskDb.tasks.update(task.id, { syncState: 'pending', syncError: undefined, canonicalTask: undefined });
    setReviewConfirmation(null);
    await refreshTasks();
    await synchronize();
  }

  async function acceptServerConflict(task: CachedTask) {
    const mutation = await reviewMutation(task, 'conflict');
    if (!mutation) return;
    const canonicalTask = await discardTaskConflict(userId, mutation.id);
    const laterLocalEdit = (await taskDb.outbox.where('userId').equals(userId).toArray())
      .some((candidate) => candidate.payload.id === task.id && candidate.syncState === 'pending');
    // The user chose the canonical version for the conflicting edit, but a
    // newer local edit remains queued. Keep it visible while it is rebased and
    // sent rather than briefly replacing it with the older server snapshot.
    await taskDb.tasks.put(laterLocalEdit
      ? { ...task, syncState: 'pending', syncError: undefined, canonicalTask: undefined }
      : { ...canonicalTask, userId, syncState: 'synced' });
    setReviewConfirmation(null);
    await refreshTasks();
    await synchronize();
  }

  async function retryRejectedTask(task: CachedTask) {
    const mutation = await reviewMutation(task, 'rejected');
    if (!mutation) return;
    await retryRejectedTaskMutation(userId, mutation.id);
    await taskDb.tasks.update(task.id, { syncState: 'pending', syncError: undefined });
    await refreshTasks();
    await synchronize();
  }

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const localTasks = await taskDb.tasks.where("userId").equals(userId).toArray();
      const mergedTasks = mergeTaskSnapshot(localTasks, initialTasks, userId, selectedTermId);
      await taskDb.transaction("rw", taskDb.tasks, async () => {
        const localIds = new Set(localTasks.map((task) => task.id));
        const mergedIds = new Set(mergedTasks.map((task) => task.id));
        await Promise.all([...localIds].filter((id) => !mergedIds.has(id)).map((id) => taskDb.tasks.delete(id)));
        await taskDb.tasks.bulkPut(mergedTasks);
      });
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
      if (retryTimer.current !== undefined) window.clearTimeout(retryTimer.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // The server snapshot is a hydration boundary; local changes remain authoritative after it loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTasks, selectedTermId, userId]);

  async function saveTask(task: CachedTask, baseUpdatedAt: string | null) {
    await taskDb.tasks.put({ ...task, syncState: "pending", syncError: undefined });
    await enqueueTaskMutation({
      id: newTaskId(),
      userId,
      operation: "upsert",
      payload: task,
      baseUpdatedAt,
    });
    await refreshTasks();
    await synchronize();
  }

  async function completeTask(task: CachedTask) {
    const updatedAt = new Date().toISOString();
    await saveTask({ ...task, completedAt: updatedAt, updatedAt }, task.updatedAt);
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedTermId) return;
    const now = new Date().toISOString();
    await saveTask({
      id: newTaskId(),
      userId,
      title: trimmedTitle,
      kind: "school",
      priority: "normal",
      termId: selectedTermId,
      dueAt: null,
      subjectId: null,
      projectId: null,
      weightPercent: null,
      description: "",
      links: [],
      effortMinutes: null,
      completedAt: null,
      updatedAt: now,
      syncState: "pending",
      source: "manual",
      sourceId: null,
    }, null);
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
        {syncState === "Sync failed" && (
          <button
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-action px-4 py-2 text-sm font-bold text-action transition hover:bg-[#f7ebe3]"
            onClick={() => void retrySynchronization()}
            type="button"
          >
            Retry sync
          </button>
        )}
        {syncState === "Needs review" && (
          <p className="text-sm font-semibold text-action">
            A task changed elsewhere. Review and edit it from its latest server version before syncing again.
          </p>
        )}
      </header>

      {tasks.filter((task) => task.syncState === 'conflict' || task.syncState === 'rejected').map((task) => (
        <section aria-label={`Review sync issue for ${task.title}`} className="mt-6 rounded-[1.5rem] border border-action/30 bg-[#fff8f3] p-5 sm:p-6" key={task.id}>
          <p className="text-sm font-semibold text-action">Sync review required</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">{task.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{task.syncError ?? 'This saved change needs your decision before it can sync.'}</p>
          {task.syncState === 'conflict' ? (
            <div className="mt-4 space-y-3">
              {reviewConfirmation === `keep:${task.id}` ? (
                <div className="rounded-xl border border-action/30 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Keep your local version and overwrite the latest server version?</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white" onClick={() => void keepLocalConflict(task)} type="button">Confirm keeping my version</button>
                    <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(null)} type="button">Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="min-h-11 rounded-xl border border-action px-4 py-2 text-sm font-bold text-action" onClick={() => setReviewConfirmation(`keep:${task.id}`)} type="button">Keep my version</button>
              )}
              {reviewConfirmation === `server:${task.id}` ? (
                <div className="rounded-xl border border-action/30 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Use the latest server version? Your local version will be removed from this task and retained in recovery history.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white" onClick={() => void acceptServerConflict(task)} type="button">Confirm using server version</button>
                    <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(null)} type="button">Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(`server:${task.id}`)} type="button">Use latest server version</button>
              )}
            </div>
          ) : (
            <button className="mt-4 min-h-11 rounded-xl border border-action px-4 py-2 text-sm font-bold text-action" onClick={() => void retryRejectedTask(task)} type="button">Retry saved change</button>
          )}
        </section>
      ))}

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
