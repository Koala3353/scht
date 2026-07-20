import { describe, expect, it } from "vitest";

import { sanitizeCanvasAssignmentHtml } from "../../lib/integrations/canvas-assignment-content";

describe("Canvas assignment content", () => {
  it("keeps useful rich assignment structure while removing executable markup", () => {
    const html = sanitizeCanvasAssignmentHtml('<p><strong>Read the brief</strong></p><ul><li>Code quotes</li></ul><table><tr><th>Risk</th><td>Cost</td></tr></table><a href="https://canvas.example.edu/files/1">Template</a><script>alert(1)</script>');
    expect(html).toContain("<strong>Read the brief</strong>");
    expect(html).toContain("<table><tr><th>Risk</th><td>Cost</td></tr></table>");
    expect(html).toContain('href="https://canvas.example.edu/files/1"');
    expect(html).not.toContain("script");
  });

  it("drops unsafe link protocols and presentation attributes", () => {
    const html = sanitizeCanvasAssignmentHtml('<p style="color:red" onclick="alert(1)">Instructions</p><a href="javascript:alert(1)">Unsafe</a>');
    expect(html).toBe("<p>Instructions</p><a>Unsafe</a>");
  });
});
