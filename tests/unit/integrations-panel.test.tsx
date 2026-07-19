import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { IntegrationsPanel } from "../../components/settings/integrations-panel";

describe("IntegrationsPanel", () => {
  it("shows the actual saved Google connection instead of a static connect state", () => {
    render(<IntegrationsPanel initialGoogleConnection={{ status: "connected", last_synced_at: "2026-07-19T08:00:00.000Z", error_message: null }} />);

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reconnect Google" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps sync unavailable until a credential has been saved", () => {
    render(<IntegrationsPanel initialGoogleConnection={null} />);

    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect Google" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
