import { z } from "zod";

function isCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateQuery = z.string().refine(isCalendarDate, "Expected a real YYYY-MM-DD date.");
const calendarRangeSchema = z.object({
  from: dateQuery.optional(),
  to: dateQuery.optional(),
});

export type CalendarRange = { from: Date; to: Date };
type LocalDate = { year: number; month: number; day: number };

export function validTimeZone(timezone: string | null | undefined): timezone is string {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function calendarTimeZone(timezone: string | null | undefined) {
  return validTimeZone(timezone) ? timezone : "UTC";
}

function numberParts(date: Date, timezone: string): LocalDate & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    calendar: "iso8601",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

/** Converts a wall-clock date at local midnight into its corresponding UTC instant. */
function localMidnight(date: LocalDate, timezone: string) {
  const desired = Date.UTC(date.year, date.month - 1, date.day);
  let instant = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = numberParts(new Date(instant), timezone);
    const observed = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant -= observed - desired;
  }
  return new Date(instant);
}

function dateAtOffset(date: LocalDate, days: number): LocalDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function parseCalendarDate(value: string): LocalDate {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function localDate(date: Date, timezone: string): LocalDate {
  const { year, month, day } = numberParts(date, timezone);
  return { year, month, day };
}

function weekday(date: Date, timezone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function defaultCalendarRange(now = new Date(), timezone = "UTC"): CalendarRange {
  const safeTimeZone = calendarTimeZone(timezone);
  const today = localDate(now, safeTimeZone);
  const weekdayOffset = (weekday(now, safeTimeZone) + 6) % 7;
  const fromDate = dateAtOffset(today, -weekdayOffset);
  const toDate = dateAtOffset(fromDate, 7);
  return { from: localMidnight(fromDate, safeTimeZone), to: localMidnight(toDate, safeTimeZone) };
}

export function resolveCalendarRange(
  search: Record<string, string | string[] | undefined>,
  now = new Date(),
  timezone = "UTC",
): CalendarRange {
  const safeTimeZone = calendarTimeZone(timezone);
  const parsed = calendarRangeSchema.safeParse({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  });
  if (!parsed.success || !parsed.data.from || !parsed.data.to) return defaultCalendarRange(now, safeTimeZone);

  const from = localMidnight(parseCalendarDate(parsed.data.from), safeTimeZone);
  const to = localMidnight(parseCalendarDate(parsed.data.to), safeTimeZone);
  return to > from ? { from, to } : defaultCalendarRange(now, safeTimeZone);
}

export function localDayLabel(value: string, timezone = "UTC") {
  const safeTimeZone = calendarTimeZone(timezone);
  const date = isCalendarDate(value)
    ? localMidnight(parseCalendarDate(value), safeTimeZone)
    : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: safeTimeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}
