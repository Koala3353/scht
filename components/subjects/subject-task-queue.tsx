import type { TaskView } from "../../lib/sync/types";
import { AssignmentPrompt } from "../ai/assignment-prompt";

export function SubjectTaskQueue({
  tasks,
  subjectLabel,
  approvedCategoryLabels,
}: {
  tasks: TaskView[];
  subjectLabel: string;
  approvedCategoryLabels: string[];
}) {
  const nextTask = tasks[0] ?? null;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-bold text-ink">Next open assignment</h3>
      {nextTask ? <div className="mt-2 space-y-3 text-sm">
        <p>
          <a aria-label={`Open task ${nextTask.title}`} className="font-semibold text-teal underline decoration-teal/30 underline-offset-4" href={`/planner?task=${nextTask.id}`}>
            {nextTask.title}
          </a>
          {nextTask.dueAt ? <span className="text-slate-600"> · due {new Date(nextTask.dueAt).toLocaleDateString()}</span> : null}
        </p>
        <AssignmentPrompt approvedCategoryLabels={approvedCategoryLabels} subjectLabel={subjectLabel} task={nextTask} />
        {tasks.length > 1 ? <p className="text-xs text-slate-600">{tasks.length - 1} more open assignment{tasks.length === 2 ? "" : "s"} in the task workspace.</p> : null}
      </div> : <p className="mt-2 text-sm text-slate-600">No open tasks.</p>}
    </div>
  );
}
