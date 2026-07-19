import { describe, expect, it } from "vitest";

import { buildTimeline } from "../../lib/reminders/timeline";

describe("buildTimeline", () => {
  const now = new Date("2026-07-19T00:00:00.000Z");

  it("combines due-dated tasks and calendar events in time order", () => {
    const timeline = buildTimeline(
      [
        { id: "canvas", title: "Canvas essay", due_at: "2026-07-20T10:00:00.000Z", source: "canvas" },
        { id: "later", title: "Problem set", due_at: "2026-07-21T10:00:00.000Z", source: "manual" },
      ],
      [
        { id: "event", title: "Consultation", starts_at: "2026-07-20T08:00:00.000Z", provider: "google_calendar" },
      ],
      now,
      3,
    );

    expect(timeline).toEqual([
      { title: "Consultation", occursAt: "2026-07-20T08:00:00.000Z", label: "Google Calendar" },
      { title: "Canvas essay", occursAt: "2026-07-20T10:00:00.000Z", label: "Canvas deadline" },
      { title: "Problem set", occursAt: "2026-07-21T10:00:00.000Z", label: "Task deadline" },
    ]);
  });

  it("excludes items outside the chosen timeline", () => {
    const timeline = buildTimeline(
      [{ id: "far", title: "Later work", due_at: "2026-07-25T10:00:00.000Z", source: "manual" }],
      [],
      now,
      3,
    );

    expect(timeline).toEqual([]);
  });
});
