"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Cloud } from "lucide-react";

import { selectAgendaTasks } from "./agenda";
import { FocusCard, chooseFocusTask } from "./focus-card";
import { mergeTaskSnapshot, shouldApplyAcceptedTask } from "../tasks/task-types";
import { TaskEditor, type TaskProject, type TaskSubject, type TaskTerm } from "../tasks/task-editor";
import { TaskList } from "../tasks/task-list";
import { taskDb } from "../../lib/sync/db";
import { discardTaskConflict, discardTaskRecovery, enqueueTaskMutation, flushTaskOutbox, resolveRejectedTaskMutation, resolveTaskConflict, retryRejectedTaskMutation, retryTaskOutbox } from "../../lib/sync/outbox";
import type { TaskInput } from "../../lib/validation/task";
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
  terms?: TaskTerm[];
  subjects?: TaskSubject[];
  projects?: TaskProject[];
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
  terms = [],
  subjects = [],
  projects = [],
}: TodayWorkspaceProps) {
  function newManualTask(): CachedTask {
    const now = new Date().toISOString();
    return {
      id: newTaskId(),
      userId,
      title: "New task",
      kind: "school",
      priority: "normal",
      termId: null,
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
    };
  }

  const [tasks, setTasks] = useState<CachedTask[]>(initialTasks);
  const [quickCaptureTask, setQuickCaptureTask] = useState<CachedTask>(() => newManualTask());
  const [syncState, setSyncState] = useState<SyncState>("Synced");
  const [reviewConfirmation, setReviewConfirmation] = useState<string | null>(null);
  const [rejectedEditor, setRejectedEditor] = useState<{ mutation: TaskMutation; task: CachedTask } | null>(null);
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

  async function openRejectedEditor(task: CachedTask) {
    const mutation = await reviewMutation(task, 'rejected');
    if (mutation) setRejectedEditor({ mutation, task });
  }

  async function resubmitRejectedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectedEditor) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('recovery-title') ?? '').trim();
    if (!title) return;
    const dueAt = String(form.get('recovery-due-at') ?? '');
    const nullableId = (name: string) => {
      const value = String(form.get(name) ?? '').trim();
      return value || null;
    };
    const resolvedTask: TaskInput = {
      ...rejectedEditor.mutation.payload,
      title,
      kind: String(form.get('recovery-kind')) as TaskInput['kind'],
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      priority: String(form.get('recovery-priority')) as TaskInput['priority'],
      description: String(form.get('recovery-description') ?? ''),
      termId: nullableId('recovery-term-id'),
      subjectId: nullableId('recovery-subject-id'),
      projectId: nullableId('recovery-project-id'),
    };
    await resolveRejectedTaskMutation(userId, rejectedEditor.mutation.id, resolvedTask);
    const hasLaterEdit = (await taskDb.outbox.where('userId').equals(userId).toArray())
      .some((candidate) => candidate.id !== rejectedEditor.mutation.id && candidate.payload.id === rejectedEditor.task.id && candidate.syncState === 'pending');
    await taskDb.tasks.update(rejectedEditor.task.id, hasLaterEdit
      ? { syncState: 'pending', syncError: undefined, canonicalTask: undefined }
      : { ...resolvedTask, syncState: 'pending', syncError: undefined, canonicalTask: undefined });
    setRejectedEditor(null);
    await refreshTasks();
    await synchronize();
  }

  async function unavailableRecoveryMutation(task: CachedTask) {
    return (await taskDb.outbox.where('userId').equals(userId).toArray())
      .find((mutation) => mutation.payload.id === task.id && !mutation.canonicalTask && !mutation.recoveryResolved && (mutation.syncState === 'conflict' || mutation.syncState === 'rejected'));
  }

  async function discardUnavailableTask(task: CachedTask) {
    const mutation = await unavailableRecoveryMutation(task);
    if (!mutation) return;
    await discardTaskRecovery(userId, mutation.id);
    const hasLaterEdit = (await taskDb.outbox.where('userId').equals(userId).toArray())
      .some((candidate) => candidate.id !== mutation.id && candidate.payload.id === task.id && candidate.syncState === 'pending');
    if (hasLaterEdit) {
      await taskDb.tasks.update(task.id, { syncState: 'pending', syncError: undefined, canonicalTask: undefined });
    } else {
      await taskDb.tasks.delete(task.id);
    }
    setReviewConfirmation(null);
    await refreshTasks();
    await synchronize();
  }

  async function recreateUnavailableTask(task: CachedTask) {
    const mutation = await unavailableRecoveryMutation(task);
    if (!mutation) return;
    await discardTaskRecovery(userId, mutation.id);
    const now = new Date().toISOString();
    const recreatedTask: CachedTask = {
      ...task,
      ...mutation.payload,
      id: newTaskId(),
      userId,
      updatedAt: now,
      syncState: 'pending',
      syncError: undefined,
      canonicalTask: undefined,
    };
    await taskDb.tasks.put(recreatedTask);
    await enqueueTaskMutation({
      id: newTaskId(),
      userId,
      operation: 'upsert',
      payload: { ...mutation.payload, id: recreatedTask.id },
      baseUpdatedAt: null,
    });
    const hasLaterEdit = (await taskDb.outbox.where('userId').equals(userId).toArray())
      .some((candidate) => candidate.id !== mutation.id && candidate.payload.id === task.id && candidate.syncState === 'pending');
    if (hasLaterEdit) {
      await taskDb.tasks.update(task.id, { syncState: 'pending', syncError: undefined, canonicalTask: undefined });
    } else {
      await taskDb.tasks.delete(task.id);
    }
    setReviewConfirmation(null);
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

  async function saveQuickCapture(task: CachedTask, baseUpdatedAt: string | null) {
    await saveTask(task, baseUpdatedAt);
    setQuickCaptureTask(newManualTask());
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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const agendaGroups = [
    { label: "Overdue", tasks: agendaTasks.filter((task) => task.dueAt && new Date(task.dueAt) < startOfToday) },
    { label: "Today", tasks: agendaTasks.filter((task) => task.dueAt && new Date(task.dueAt) >= startOfToday && new Date(task.dueAt) < startOfTomorrow) },
    { label: "Upcoming", tasks: agendaTasks.filter((task) => task.dueAt && new Date(task.dueAt) >= startOfTomorrow) },
    { label: "No deadline", tasks: agendaTasks.filter((task) => !task.dueAt) },
  ].filter((group) => group.tasks.length > 0);

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
          {!task.canonicalTask ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-slate-700">The server task is no longer available, so there is no version to merge with.</p>
              {reviewConfirmation === `discard:${task.id}` ? (
                <div className="rounded-xl border border-action/30 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Discard this saved local change? This cannot be undone.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white" onClick={() => void discardUnavailableTask(task)} type="button">Confirm discard local change</button>
                    <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(null)} type="button">Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="min-h-11 rounded-xl border border-action px-4 py-2 text-sm font-bold text-action" onClick={() => setReviewConfirmation(`discard:${task.id}`)} type="button">Discard local change</button>
              )}
              {reviewConfirmation === `recreate:${task.id}` ? (
                <div className="rounded-xl border border-action/30 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Create this saved change as a new task? The missing task will not be restored.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white" onClick={() => void recreateUnavailableTask(task)} type="button">Confirm recreate as new task</button>
                    <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(null)} type="button">Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setReviewConfirmation(`recreate:${task.id}`)} type="button">Recreate as new task</button>
              )}
              {task.syncState === 'rejected' && (
                <div className="flex flex-wrap gap-3">
                  <button className="min-h-11 rounded-xl border border-action px-4 py-2 text-sm font-bold text-action" onClick={() => void retryRejectedTask(task)} type="button">Retry saved change</button>
                  <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => void openRejectedEditor(task)} type="button">Edit and resubmit</button>
                </div>
              )}
            </div>
          ) : task.syncState === 'conflict' ? (
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
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="min-h-11 rounded-xl border border-action px-4 py-2 text-sm font-bold text-action" onClick={() => void retryRejectedTask(task)} type="button">Retry saved change</button>
              <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => void openRejectedEditor(task)} type="button">Edit and resubmit</button>
            </div>
          )}
        </section>
      ))}

      {rejectedEditor && (
        <div aria-labelledby="recovery-editor-title" aria-modal="true" className="mt-6 rounded-[1.5rem] border border-action/30 bg-white p-5 shadow-sm sm:p-6" role="dialog">
          <h2 className="text-xl font-black tracking-tight" id="recovery-editor-title">Edit and resubmit saved change</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Update the rejected fields, then explicitly resubmit this saved change. Later edits stay queued until it is accepted.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={resubmitRejectedTask}>
            <label className="grid gap-1 text-sm font-bold text-ink sm:col-span-2">Title
              <input className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.title} name="recovery-title" required />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Due date and time
              <input className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.dueAt?.slice(0, 16) ?? ''} name="recovery-due-at" type="datetime-local" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Priority
              <select className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.priority} name="recovery-priority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Kind
              <select className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.kind} name="recovery-kind"><option value="school">School</option><option value="work">Work</option><option value="personal">Personal</option></select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Term ID
              <input className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.termId ?? ''} name="recovery-term-id" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Subject ID
              <input className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.subjectId ?? ''} name="recovery-subject-id" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">Project ID
              <input className="rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.projectId ?? ''} name="recovery-project-id" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink sm:col-span-2">Description
              <textarea className="min-h-24 rounded-xl border border-slate-300 px-3 py-2" defaultValue={rejectedEditor.mutation.payload.description} name="recovery-description" />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button className="min-h-11 rounded-xl bg-action px-4 py-2 text-sm font-bold text-white" type="submit">Resubmit saved change</button>
              <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-ink" onClick={() => setRejectedEditor(null)} type="button">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.8fr)]">
        <FocusCard task={focusTask} />
        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-teal">Quick capture</p>
          <h2 className="mt-2 text-xl font-black tracking-tight">
            Keep the small things visible.
          </h2>
          <div className="mt-5">
            <TaskEditor baseUpdatedAt={null} currentTermId={selectedTermId} defaultToCurrentTerm key={quickCaptureTask.id} onSave={saveQuickCapture} projects={projects} subjects={subjects} task={quickCaptureTask} terms={terms} />
          </div>
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
        {agendaGroups.length ? <div className="space-y-7">{agendaGroups.map((group) => <section key={group.label}><h3 className="mb-3 text-sm font-bold text-slate-600">{group.label}</h3><TaskList currentTermId={selectedTermId} onSave={saveTask} projects={projects} subjects={subjects} tasks={group.tasks} terms={terms} /></section>)}</div> : <p className="rounded-xl bg-[#f7faf9] p-4 text-sm text-slate-700">Nothing is due yet.</p>}
      </section>
    </main>
  );
}
