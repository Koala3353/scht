'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Agenda, selectAgendaTasks } from '@/components/today/agenda';
import { FocusCard, chooseFocusTask } from '@/components/today/focus-card';
import { taskDb } from '@/lib/sync/db';
import { enqueueTaskMutation, flushTaskOutbox } from '@/lib/sync/outbox';
import type { CachedTask, TaskMutation, TaskSyncResponse } from '@/lib/sync/types';

type SyncState = 'Offline' | 'Syncing' | 'Synced' | 'Needs review';
interface TodayWorkspaceProps { initialTasks: CachedTask[]; selectedTermId: string | null; }

async function postTaskMutations(mutations: TaskMutation[]): Promise<TaskSyncResponse> {
  const response = await fetch('/api/sync/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mutations }) });
  if (!response.ok) throw new Error('Task sync failed.');
  return response.json() as Promise<TaskSyncResponse>;
}

function newTaskId() { return crypto.randomUUID(); }

export function TodayWorkspace({ initialTasks, selectedTermId }: TodayWorkspaceProps) {
  const [tasks, setTasks] = useState<CachedTask[]>(initialTasks);
  const [syncState, setSyncState] = useState<SyncState>('Synced');
  const [title, setTitle] = useState('');
  const agendaTasks = useMemo(() => selectedTermId ? selectAgendaTasks(tasks, selectedTermId) : [], [selectedTermId, tasks]);

  async function refreshTasks() {
    if (!selectedTermId) return;
    setTasks(await taskDb.tasks.where('termId').equals(selectedTermId).toArray());
  }

  async function synchronize() {
    if (!navigator.onLine) { setSyncState('Offline'); return; }
    setSyncState('Syncing');
    try {
      const response = await flushTaskOutbox(postTaskMutations);
      setSyncState(response.rejected.length > 0 ? 'Needs review' : 'Synced');
    } catch { setSyncState('Offline'); }
  }

  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (initialTasks.length > 0) await taskDb.tasks.bulkPut(initialTasks);
      if (active) await refreshTasks();
      if (active) await synchronize();
    }
    void hydrate();
    const handleOnline = () => { void synchronize(); };
    const handleOffline = () => setSyncState('Offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { active = false; window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  // The server snapshot is intentionally a hydration boundary; local changes remain authoritative after it loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermId]);

  async function saveTask(task: CachedTask) {
    await taskDb.tasks.put(task);
    await enqueueTaskMutation({ id: newTaskId(), operation: 'upsert', payload: task });
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
    await saveTask({ id: newTaskId(), title: trimmedTitle, kind: 'school', priority: 'normal', termId: selectedTermId, dueAt: null, subjectId: null, weightPercent: null, completedAt: null, updatedAt: now });
    setTitle('');
  }

  if (!selectedTermId) return <section className="mx-auto max-w-3xl rounded-3xl border border-teal/20 bg-white p-6 shadow-sm"><h1 className="text-3xl font-bold tracking-tight">Set your current term first.</h1><p className="mt-2 text-teal-900">Complete onboarding to bring your courses and agenda into view.</p></section>;

  const focusTask = chooseFocusTask(agendaTasks);
  return <main className="mx-auto max-w-3xl pb-28 sm:px-2"><section className="rounded-3xl border border-teal/20 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[.14em] text-teal">TODAY</p><h1 className="mt-2 text-3xl font-bold tracking-tight">A clear day starts here.</h1><p className="mt-2 text-teal-900">Your current term keeps the important work in view without the clutter.</p></div><p aria-live="polite" className="shrink-0 rounded-full bg-teal/10 px-3 py-2 text-xs font-bold text-teal">{syncState}</p></div><FocusCard task={focusTask} /><form className="mt-5 flex gap-2" onSubmit={addTask}><label className="sr-only" htmlFor="new-task-title">New task title</label><input id="new-task-title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3" maxLength={180} placeholder="Add a task for this term" /><button type="submit" className="rounded-xl bg-action px-4 font-bold text-white">Add task</button></form></section><header className="mt-7 flex items-center justify-between"><h2 className="text-lg font-bold">Your agenda</h2><a className="text-sm font-bold text-teal" href="#calendar">View calendar →</a></header><Agenda tasks={agendaTasks} onComplete={completeTask} /></main>;
}
