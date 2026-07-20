import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocalDateTime } from "../../components/format/local-date-time";

describe("LocalDateTime", () => {
  it("uses a deterministic server fallback before applying the device locale", () => {
    const markup = renderToStaticMarkup(<LocalDateTime value="2026-07-20T09:00:00.000Z" fallback="last synced" />);

    expect(markup).toContain("last synced");
    expect(markup).toContain('dateTime="2026-07-20T09:00:00.000Z"');
  });
});
