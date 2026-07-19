import type { CachedTask, TaskView } from "@/lib/sync/types";

/** Complete database selection required to build the canonical task contract. */
export const taskColumns =
  "id,user_id,title,kind,due_at,priority,term_id,subject_id,project_id,weight_percent,notes,links,effort_minutes,completed_at,updated_at,source,source_id";

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  kind: "school" | "work" | "personal";
  due_at: string | null;
  priority: "low" | "normal" | "high";
  term_id: string | null;
  subject_id: string | null;
  project_id: string | null;
  weight_percent: number | null;
  notes: string | null;
  links: string[] | null;
  effort_minutes: number | null;
  completed_at: string | null;
  updated_at: string;
  source: string;
  source_id: string | null;
};

/** Maps a persisted task without dropping editable task context. */
export function toTaskView(row: TaskRow): TaskView {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    dueAt: row.due_at,
    priority: row.priority,
    termId: row.term_id,
    subjectId: row.subject_id,
    projectId: row.project_id,
    weightPercent: row.weight_percent,
    description: row.notes ?? "",
    links: row.links ?? [],
    effortMinutes: row.effort_minutes,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    source: row.source,
    sourceId: row.source_id,
  };
}

export function toCachedTask(row: TaskRow): CachedTask {
  return {
    ...toTaskView(row),
    userId: row.user_id,
    syncState: "synced",
  };
}
