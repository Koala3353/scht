import { describe, expect, it } from "vitest";

import { DEFAULT_GMAIL_TASK_FILTERS, gmailTaskFilters, gmailTaskListQuery, messageMatchesGmailTaskFilters } from "../../lib/integrations/gmail-filters";

describe("Gmail task filters", () => {
  it("starts with academic task triggers and keeps optional inbox categories off", () => {
    expect(DEFAULT_GMAIL_TASK_FILTERS.taskTriggers).toContain("assignment");
    expect(DEFAULT_GMAIL_TASK_FILTERS.includedCategories.promotions).toBe(false);
    expect(gmailTaskListQuery()).not.toContain("category:promotions");
  });

  it("requires a trigger and lets an exclusion win", () => {
    const filters = gmailTaskFilters({ taskTriggers: ["assignment"], excludedPhrases: ["sale"] });
    expect(messageMatchesGmailTaskFilters({ snippet: "Your assignment is due tomorrow" }, filters)).toBe(true);
    expect(messageMatchesGmailTaskFilters({ snippet: "Assignment sale ends tonight" }, filters)).toBe(false);
    expect(messageMatchesGmailTaskFilters({ snippet: "A quiet inbox update" }, filters)).toBe(false);
  });

  it("allows optional Gmail categories only when their setting is enabled", () => {
    const blocked = gmailTaskFilters({ taskTriggers: ["assignment"], includedCategories: { promotions: false, social: false, updates: false } });
    const allowed = gmailTaskFilters({ taskTriggers: ["assignment"], includedCategories: { promotions: true, social: false, updates: false } });
    const promotion = { labelIds: ["INBOX", "CATEGORY_PROMOTIONS"], snippet: "Assignment feedback is available" };

    expect(messageMatchesGmailTaskFilters(promotion, blocked)).toBe(false);
    expect(messageMatchesGmailTaskFilters(promotion, allowed)).toBe(true);
  });
});
