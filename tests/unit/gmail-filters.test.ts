import { describe, expect, it } from "vitest";

import { DEFAULT_GMAIL_TASK_FILTERS, gmailTaskFilters, gmailTaskListQuery, messageMatchesGmailTaskFilters } from "../../lib/integrations/gmail-filters";

describe("Gmail task filters", () => {
  it("starts with academic task triggers and promotion-safe exclusions", () => {
    expect(DEFAULT_GMAIL_TASK_FILTERS.taskTriggers).toContain("assignment");
    expect(DEFAULT_GMAIL_TASK_FILTERS.excludedPhrases).toContain("promotion");
    expect(gmailTaskListQuery()).toContain("-category:promotions");
  });

  it("requires a trigger and lets an exclusion win", () => {
    const filters = gmailTaskFilters({ taskTriggers: ["assignment"], excludedPhrases: ["sale"] });
    expect(messageMatchesGmailTaskFilters({ snippet: "Your assignment is due tomorrow" }, filters)).toBe(true);
    expect(messageMatchesGmailTaskFilters({ snippet: "Assignment sale ends tonight" }, filters)).toBe(false);
    expect(messageMatchesGmailTaskFilters({ snippet: "A quiet inbox update" }, filters)).toBe(false);
  });
});
