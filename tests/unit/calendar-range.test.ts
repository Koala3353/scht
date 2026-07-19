import { describe, expect, it } from "vitest";

import { calendarTimeZone, defaultCalendarRange, localDayLabel, resolveCalendarRange } from "../../lib/calendar/range";

describe("calendar range", () => {
  it("uses the student's IANA timezone for current-week boundaries", () => {
    const now = new Date("2026-07-19T23:30:00.000Z");

    expect(defaultCalendarRange(now, "Asia/Manila").from.toISOString()).toBe("2026-07-19T16:00:00.000Z");
    expect(defaultCalendarRange(now, "UTC").from.toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });

  it("rejects impossible date query values instead of normalizing them", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");

    expect(resolveCalendarRange({ from: "2026-02-30", to: "2026-03-02" }, now, "UTC")).toEqual(
      defaultCalendarRange(now, "UTC"),
    );
  });

  it("groups entries by the student's timezone and safely falls back for an invalid preference", () => {
    expect(localDayLabel("2026-07-19T23:30:00.000Z", "Asia/Manila")).toContain("Monday");
    expect(calendarTimeZone("Not/AZone")).toBe("UTC");
  });
});
