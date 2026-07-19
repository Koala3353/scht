import { describe, expect, it } from "vitest";
import {
  normalizeCanvasBaseUrl,
  validCanvasToken,
} from "../../lib/validation/canvas-input";

describe("Canvas connection input", () => {
  it("normalizes a secure Canvas URL and rejects unsafe targets", () => {
    expect(normalizeCanvasBaseUrl(" https://canvas.ateneo.edu/ ")).toBe(
      "https://canvas.ateneo.edu",
    );
    expect(normalizeCanvasBaseUrl("http://canvas.ateneo.edu")).toBeNull();
    expect(normalizeCanvasBaseUrl("https://localhost:3000")).toBeNull();
    expect(
      normalizeCanvasBaseUrl("https://user:pass@canvas.ateneo.edu"),
    ).toBeNull();
  });

  it("requires a plausibly sized personal access token", () => {
    expect(validCanvasToken("too-short")).toBe(true);
    expect(validCanvasToken("short")).toBe(false);
    expect(validCanvasToken("x".repeat(4097))).toBe(false);
  });
});
