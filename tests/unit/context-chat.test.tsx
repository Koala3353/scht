import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContextChat } from "../../components/ai/context-chat";
import { ToastProvider } from "../../components/feedback/toast-provider";

afterEach(cleanup);

describe("ContextChat", () => {
  it("keeps connected workspace context off until the student has opted in", () => {
    render(<ToastProvider><ContextChat connectedDataOptIn={false} /></ToastProvider>);

    expect((screen.getByLabelText("Include my connected workspace context") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Enable this in/i)).toBeTruthy();
  });

  it("allows an opted-in student to use context for an individual question", () => {
    render(<ToastProvider><ContextChat connectedDataOptIn /></ToastProvider>);

    const toggle = screen.getByLabelText("Include my connected workspace context") as HTMLInputElement;
    expect(toggle.disabled).toBe(false);
    expect(toggle.checked).toBe(true);
  });
});
