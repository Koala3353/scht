import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ToastProvider } from "../../components/feedback/toast-provider";
import { ReminderPanel } from "../../components/settings/reminder-panel";
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

  it("renders the opted-in recipient-local weekly cadence and horizon", () => {
    render(createElement(ToastProvider, null, createElement(ReminderPanel, {
      preference: { timezone: "Asia/Manila", quiet_start: null, quiet_end: null, enabled: true, digest_window_days: 14, digest_enabled: true, digest_time: "07:30:00", digest_frequency: "weekly", digest_weekday: 5 },
      tasks: [],
    })));

    expect(screen.getByText(/recipient time zone \(Asia\/Manila\) at 07:30 on Friday/).textContent).toContain("Task horizon: the next 14 days");
  });
});

afterEach(cleanup);
