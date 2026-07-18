import { Sparkles } from 'lucide-react';

import type { CachedTask } from '@/lib/sync/types';

export function chooseFocusTask(tasks: CachedTask[]) {
  return tasks.find((task) => (task.weightPercent ?? 0) > 0) ?? tasks[0] ?? null;
}

export function FocusCard({ task }: { task: CachedTask | null }) {
  if (!task) {
    return <div className="mt-5 rounded-2xl border border-teal/20 bg-teal/5 p-4"><p className="font-bold">Your day is clear.</p><p className="mt-1 text-sm text-teal-900">Add a task when you are ready and Scht will keep it in sync.</p></div>;
  }

  return <div className="mt-5 flex gap-3 rounded-2xl border border-teal/20 bg-teal/5 p-4"><Sparkles className="mt-0.5 shrink-0 text-teal" aria-hidden="true" /><div><b>Start with {task.title}</b><p className="text-sm text-teal-900">{task.weightPercent ? `Worth ${task.weightPercent}% of your course grade` : task.priority === 'high' ? 'High-priority work' : 'Your next scheduled task'}</p></div></div>;
}
