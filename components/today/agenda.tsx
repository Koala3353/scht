'use client';

import { CheckCircle2, Clock3 } from 'lucide-react';

import type { CachedTask } from '@/lib/sync/types';

interface AgendaProps { tasks: CachedTask[]; onComplete: (task: CachedTask) => void; }

function dueTimestamp(task: CachedTask) { return task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY; }
function priorityWeight(task: CachedTask) { return task.priority === 'high' ? 0 : task.priority === 'normal' ? 1 : 2; }

export function selectAgendaTasks(tasks: CachedTask[], currentTermId: string) {
  return tasks.filter((task) => task.termId === currentTermId && !task.completedAt).sort((first, second) => dueTimestamp(first) - dueTimestamp(second) || priorityWeight(first) - priorityWeight(second) || (second.weightPercent ?? 0) - (first.weightPercent ?? 0) || first.title.localeCompare(second.title));
}

function formatDueTime(dueAt: string | null | undefined) {
  if (!dueAt) return 'Any time';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(dueAt));
}

export function Agenda({ tasks, onComplete }: AgendaProps) {
  if (tasks.length === 0) return <section className="mt-3 rounded-2xl border border-dashed border-teal/30 bg-white p-6 text-center"><Clock3 className="mx-auto text-teal" aria-hidden="true" /><h3 className="mt-3 font-bold">Nothing scheduled for this term yet.</h3><p className="mt-1 text-sm text-slate-600">Add a task and it will stay available even when you are offline.</p></section>;

  return <ol className="mt-3 space-y-3" aria-label="Current term agenda">{tasks.map((task) => {
    const highImpact = (task.weightPercent ?? 0) > 0;
    return <li className="grid grid-cols-[4.5rem_1fr] gap-3" key={task.id}><time className="pt-4 text-right text-sm font-bold text-slate-500" dateTime={task.dueAt ?? undefined}>{formatDueTime(task.dueAt)}</time><article className="flex min-h-24 items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><h3 className="font-bold">{task.title}</h3><p className="mt-1 text-sm text-slate-500">{task.kind[0].toUpperCase() + task.kind.slice(1)}{task.priority === 'high' ? ' · High priority' : ''}</p>{highImpact && <span className="mt-2 inline-block rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">HIGH IMPACT · {task.weightPercent}%</span>}</div><button type="button" aria-label={`Complete ${task.title}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-teal/10 hover:text-teal" onClick={() => onComplete(task)}><CheckCircle2 aria-hidden="true" /></button></article></li>;
  })}</ol>;
}
