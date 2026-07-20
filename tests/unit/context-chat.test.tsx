import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextChat } from "../../components/ai/context-chat";
import { ToastProvider } from "../../components/feedback/toast-provider";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

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

  it("uses the Settings-unlocked key and sends with Command+Enter", async () => {
    sessionStorage.setItem("scht-unlocked-ai-keys", JSON.stringify({ openai: "saved-key-123" }));
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ message: "Start with the quiz.", usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ToastProvider><ContextChat connectedDataOptIn /></ToastProvider>);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Ask Scht about your semester"), "What should I do?");
    fireEvent.keyDown(screen.getByLabelText("Ask Scht about your semester"), { key: "Enter", metaKey: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ apiKey: "saved-key-123" });
    expect(screen.getByText(/Last answer: 20 tokens/)).toBeTruthy();
  });
});
