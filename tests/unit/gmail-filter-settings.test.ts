import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { PUT } from "../../app/api/integrations/google/filters/route";

function connectionQuery(settings: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
  };
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  const result = { data: [{ id: "google-connection", settings }], error: null };
  chain.update.mockReturnValue(chain);
  Object.assign(chain, { then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) });
  return chain;
}

describe("Gmail filter settings", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("stores editable filters without removing the connection's sync status", async () => {
    const connection = connectionQuery({ sync: { calendar: { state: "synced" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn(() => connection),
    });

    const response = await PUT(new Request("https://scht.test/api/integrations/google/filters", {
      method: "PUT",
      body: JSON.stringify({ taskTriggers: ["Assignment"], excludedPhrases: ["Sale"], includedCategories: { promotions: true, social: false, updates: true } }),
    }));

    expect(response.status).toBe(200);
    expect(connection.update).toHaveBeenCalledWith({
      settings: {
        sync: { calendar: { state: "synced" } },
        gmailTaskFilters: { taskTriggers: ["assignment"], excludedPhrases: ["sale"], includedCategories: { promotions: true, social: false, updates: true } },
      },
    });
  });
});
