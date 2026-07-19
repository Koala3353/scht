export type DigestFrequency = "daily" | "weekly";

export function weekdayInTimezone(now: Date, timezone: string) {
  const shortName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(shortName);
}

export function isDigestDue({
  frequency,
  weekday,
  now,
  timezone,
}: {
  frequency: DigestFrequency | null | undefined;
  weekday: number | null | undefined;
  now: Date;
  timezone: string;
}) {
  return frequency !== "weekly" || weekdayInTimezone(now, timezone) === (weekday ?? 1);
}
