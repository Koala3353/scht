import { describe, expect, it } from "vitest";
import {
  googleAudienceUrl,
  googleClientCreationUrl,
} from "../../lib/admin/google-auth";

describe("Google Cloud account links", () => {
  it("links new users to the Google Auth Platform test-user page", () => {
    expect(googleAudienceUrl("scht-502902")).toBe(
      "https://console.cloud.google.com/auth/audience?project=scht-502902",
    );
  });

  it("uses the configured project safely and keeps client creation separate", () => {
    expect(googleAudienceUrl("my school project")).toBe(
      "https://console.cloud.google.com/auth/audience?project=my%20school%20project",
    );
    expect(googleClientCreationUrl("scht-502902")).toBe(
      "https://console.cloud.google.com/auth/clients/create?project=scht-502902",
    );
  });
});
