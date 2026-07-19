import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { IpsImport } from "../../components/onboarding/ips-import";

afterEach(cleanup);

describe("IPS import preview", () => {
  it("keeps the selected term and parsed items reviewable before import", async () => {
    render(<IpsImport academicYear={2026} termId="term-1" termLabel="Fall 2026" termName="First Semester" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Paste IPS"), "First Year\nFirst Semester\nP ENLIT 12 3 C Y N");

    expect(screen.getByText(/Active term:/).textContent).toContain("Fall 2026");
    expect(screen.getByText(/Selected program year:/).textContent).toContain("Year 1");
    expect(screen.getByText("ENLIT 12")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Import 1 course" })).not.toBeNull();
  });
});
