import { describe, expect, it } from "vitest";

import { isDigestDue, weekdayInTimezone } from "../../lib/reminders/digest-schedule";

describe("digest schedule", () => {
  const mondayMorningUtc = new Date("2026-07-20T01:00:00.000Z");

  it("uses the recipient timezone when determining the scheduled weekday", () => {
    expect(weekdayInTimezone(mondayMorningUtc, "Asia/Manila")).toBe(1);
    expect(weekdayInTimezone(mondayMorningUtc, "America/Los_Angeles")).toBe(0);
  });

  it("allows daily email and restricts weekly email to its selected day", () => {
    expect(isDigestDue({ frequency: "daily", weekday: 1, now: mondayMorningUtc, timezone: "Asia/Manila" })).toBe(true);
    expect(isDigestDue({ frequency: "weekly", weekday: 1, now: mondayMorningUtc, timezone: "Asia/Manila" })).toBe(true);
    expect(isDigestDue({ frequency: "weekly", weekday: 2, now: mondayMorningUtc, timezone: "Asia/Manila" })).toBe(false);
  });

  it("describes the opted-in local delivery cadence on Settings", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile("components/settings/reminder-panel.tsx", "utf8"));
    expect(source).toContain("recipient time zone");
    expect(source).toContain("Task horizon");
  });
});
