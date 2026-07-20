import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeliveryLog } from "../../components/admin/delivery-log";
import { OperationsCharts } from "../../components/admin/operations-charts";

vi.mock("../../components/feedback/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("admin operations console", () => {
  it("renders operational charts from workspace health data", () => {
    render(
      <OperationsCharts
        activity={[{ label: "Mon", tasks: 4, emails: 2 }]}
        connections={{ connected: 3, attention: 1, disconnected: 2 }}
        deliveries={{ sent: 8, failed: 1, pending: 2 }}
        tasks={{ open: 14, completed: 9 }}
      />,
    );

    expect(screen.getByRole("region", { name: "Workspace operations charts" })).toBeTruthy();
    expect(screen.getByText("Task and email volume")).toBeTruthy();
    expect(screen.getByText("Provider status")).toBeTruthy();
    expect(screen.getByText("Emails sent")).toBeTruthy();
  });

  it("filters email delivery history by status and search text", () => {
    render(
      <DeliveryLog
        deliveries={[
          { id: "sent", recipient: "student@example.edu", kind: "Task reminder", status: "sent", occurredAt: "2026-07-20T01:00:00.000Z", detail: "Research paper" },
          { id: "failed", recipient: "other@example.edu", kind: "Scheduled update", status: "failed", occurredAt: "2026-07-19T01:00:00.000Z", detail: "Delivery failed" },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Filter delivery status"), { target: { value: "failed" } });
    expect(screen.queryByText("student@example.edu")).toBeNull();
    expect(screen.getByText("other@example.edu")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search delivery history"), { target: { value: "student" } });
    expect(screen.getByText(/No delivery records match/i)).toBeTruthy();
  });

  it("keeps the dashboard data endpoint owner-protected and never returns provider credentials", () => {
    const testDirectory = path.dirname(fileURLToPath(import.meta.url));
    const route = readFileSync(path.resolve(testDirectory, "../../app/api/admin/users/[userId]/route.ts"), "utf8");
    const page = readFileSync(path.resolve(testDirectory, "../../app/(admin)/admin/page.tsx"), "utf8");
    const dispatch = readFileSync(path.resolve(testDirectory, "../../app/api/reminders/dispatch/route.ts"), "utf8");

    expect(route).toContain("await requireOwnerAdmin()");
    expect(route).toContain("auth.admin.getUserById");
    expect(route).not.toContain("encrypted_credentials");
    expect(page).toContain("<UserDebugger users={directory} />");
    expect(page).toContain("<DeliveryLog deliveries={deliveryEvents} />");
    expect(dispatch).toContain('const status = body.success ? "sent" : "pending";');
  });
});
