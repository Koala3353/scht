import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

import { IntegrationsPanel } from "../../components/settings/integrations-panel";
import { ToastProvider } from "../../components/feedback/toast-provider";

function renderPanel(google: Parameters<typeof IntegrationsPanel>[0]["initialGoogleConnection"], canvas: Parameters<typeof IntegrationsPanel>[0]["initialCanvasConnection"] = null) {
  return render(<ToastProvider><IntegrationsPanel initialCanvasConnection={canvas} initialGoogleConnection={google} /></ToastProvider>);
}

describe("IntegrationsPanel", () => {
  it("shows the actual saved Google connection instead of a static connect state", () => {
    renderPanel({ status: "connected", last_synced_at: "2026-07-19T08:00:00.000Z", error_message: null });

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Reconnect Google" })).toBeNull();
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps sync unavailable until a credential has been saved", () => {
    renderPanel(null);

    expect(screen.getAllByText("Not connected")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Connect Google" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps a saved Canvas connection visible without exposing its token", () => {
    renderPanel(null, { status: "connected", last_synced_at: "2026-07-19T08:00:00.000Z", error_message: null, settings: { baseUrl: "https://canvas.example.edu" } });

    expect(screen.getByText(/Connected securely to canvas\.example\.edu./)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync assignments" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Personal API token (enter only to replace)") as HTMLInputElement).value).toBe("");
  });

  it("keeps Google sync available and renders one provider result for a degraded Gmail refresh", () => {
    renderPanel({
      status: "connected",
      last_synced_at: "2026-07-19T08:00:00.000Z",
      error_message: null,
      settings: {
        sync: {
          calendar: { state: "synced", imported: 2, message: "2 Calendar events imported." },
          gmail: { state: "degraded", imported: 0, message: "Gmail is temporarily rate-limited. Your Calendar update is safe; try Gmail again after 2 minutes." },
        },
      },
    });

    expect((screen.getByRole("button", { name: "Retry Gmail" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByText(/Gmail is temporarily rate-limited/)).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Reconnect Google" })).toBeNull();
  });

  it("loads saved Gmail task filters for editing", () => {
    renderPanel({
      status: "connected",
      last_synced_at: null,
      error_message: null,
      settings: { gmailTaskFilters: { taskTriggers: ["assignment"], excludedPhrases: ["sale"], includedCategories: { promotions: true, social: false, updates: false } } },
    });

    expect((screen.getByLabelText(/Task triggers/) as HTMLTextAreaElement).value).toBe("assignment");
    expect((screen.getByLabelText(/Never create a task/) as HTMLTextAreaElement).value).toBe("sale");
    expect((screen.getByLabelText("Promotions") as HTMLInputElement).checked).toBe(true);
  });
});
