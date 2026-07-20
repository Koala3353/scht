import { describe, expect, it } from "vitest";

import { canvasErrorKind, CanvasApiError } from "../../lib/integrations/canvas";

describe("Canvas connection errors", () => {
  it("keeps a saved connection retryable after a temporary provider outage", () => {
    expect(canvasErrorKind(new CanvasApiError("retryable", "Canvas is temporarily unavailable."))).toBe("retryable");
  });

  it("requires reconnection only when Canvas rejects its credential or site", () => {
    expect(canvasErrorKind(new CanvasApiError("needs_reconnect", "Canvas token is invalid or has expired."))).toBe("needs_reconnect");
  });
});
