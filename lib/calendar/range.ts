import { z } from "zod";

const dateQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const calendarRangeSchema = z.object({
  from: dateQuery.optional(),
  to: dateQuery.optional(),
});

export type CalendarRange = { from: Date; to: Date };

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseLocalDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function defaultCalendarRange(now = new Date()): CalendarRange {
  const from = startOfLocalDay(now);
  const weekday = (from.getDay() + 6) % 7;
  from.setDate(from.getDate() - weekday);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

export function resolveCalendarRange(search: Record<string, string | string[] | undefined>, now = new Date()): CalendarRange {
  const parsed = calendarRangeSchema.safeParse({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  });
  if (!parsed.success || !parsed.data.from || !parsed.data.to) return defaultCalendarRange(now);

  const from = parseLocalDay(parsed.data.from);
  const to = parseLocalDay(parsed.data.to);
  return to > from ? { from, to } : defaultCalendarRange(now);
}

export function localDayLabel(value: string) {
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDay(value) : new Date(value);
  return localDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
