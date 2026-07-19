export type DigestTask = {
  id: string;
  title: string;
  due_at: string | null;
  source: string;
};

export type DigestEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  provider: string;
};

export type TimelineItem = {
  title: string;
  occursAt: string;
  label: string;
};

const sourceLabel = (source: string) => {
  if (source === "canvas") return "Canvas deadline";
  if (source === "gmail") return "Gmail follow-up";
  return "Task deadline";
};

export function buildTimeline(
  tasks: DigestTask[],
  events: DigestEvent[],
  now: Date,
  days: number,
  limit = 8,
): TimelineItem[] {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const datedTasks = tasks.flatMap((task) => {
    if (!task.due_at) return [];
    const due = new Date(task.due_at);
    return due >= now && due <= end
      ? [{ title: task.title, occursAt: due.toISOString(), label: sourceLabel(task.source) }]
      : [];
  });
  const datedEvents = events.flatMap((event) => {
    if (!event.starts_at) return [];
    const startsAt = new Date(event.starts_at);
    return startsAt >= now && startsAt <= end
      ? [{ title: event.title, occursAt: startsAt.toISOString(), label: "Google Calendar" }]
      : [];
  });
  return [...datedTasks, ...datedEvents]
    .sort((left, right) => left.occursAt.localeCompare(right.occursAt))
    .slice(0, limit);
}
