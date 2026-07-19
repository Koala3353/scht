import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { AdminSignIn } from "../../components/auth/admin-sign-in";

describe("AdminSignIn", () => {
  afterEach(cleanup);

  it("explains when an authenticated account is not an owner admin", () => {
    render(
      <AdminSignIn
        error="not-owner"
        googleAudienceUrl="https://console.cloud.google.com/auth/audience?project=scht-502902"
      />,
    );

    expect(
      screen.getByText(/signed in successfully, but it is not approved/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("makes the Google test-user requirement clear before OAuth begins", () => {
    render(
      <AdminSignIn
        error="google-access-denied"
        googleAudienceUrl="https://console.cloud.google.com/auth/audience?project=scht-502902"
      />,
    );

    expect(screen.getByText(/Google rejected this account/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /open Google test users/i }).getAttribute("href")).toBe(
      "https://console.cloud.google.com/auth/audience?project=scht-502902",
    );
  });
});
