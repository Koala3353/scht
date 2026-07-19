import type { TaskView } from "../../lib/sync/types";

export function SubjectTaskQueue({ tasks }: { tasks: TaskView[] }) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-bold text-ink">Open tasks</h3>
      <ul className="mt-2 space-y-2">
        {tasks.map((task) => (
          <li className="text-sm" key={task.id}>
            <a
              aria-label={`Open task ${task.title}`}
              className="font-semibold text-teal underline decoration-teal/30 underline-offset-4"
              href={`/planner?task=${task.id}`}
            >
              {task.title}
            </a>
            {task.dueAt ? (
              <span className="text-slate-600">
                {" "}· due {new Date(task.dueAt).toLocaleDateString()}
              </span>
            ) : null}
          </li>
        ))}
        {!tasks.length ? <li className="text-sm text-slate-600">No open tasks.</li> : null}
      </ul>
    </div>
  );
}
