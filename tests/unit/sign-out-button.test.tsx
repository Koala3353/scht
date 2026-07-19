import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { SignOutButton } from "../../components/auth/sign-out-button";

describe("SignOutButton", () => {
  it("ends only the current browser session before returning home", async () => {
    signOut.mockResolvedValue({ error: null });

    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });
});
