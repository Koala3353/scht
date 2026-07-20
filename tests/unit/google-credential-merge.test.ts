import { describe, expect, it } from "vitest";

import { mergeGoogleCredential } from "../../lib/integrations/google";

describe("Google credential persistence", () => {
  it("keeps a previously granted refresh token when OAuth only returns a new access token", () => {
    expect(mergeGoogleCredential({ accessToken: "fresh-access-token" }, {
      accessToken: "old-access-token",
      refreshToken: "durable-refresh-token",
      expiresAt: "2026-07-21T00:00:00.000Z",
    })).toMatchObject({
      accessToken: "fresh-access-token",
      refreshToken: "durable-refresh-token",
    });
  });
});
