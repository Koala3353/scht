import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  decryptCredentials: vi.fn(),
  encryptCredentials: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../lib/integrations/credentials", () => ({
  decryptCredentials: mocks.decryptCredentials,
  encryptCredentials: mocks.encryptCredentials,
}));

import { POST } from "../../app/api/integrations/google/sync/route";
import { googleApi, GoogleApiError } from "../../lib/integrations/google";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function query(result: { data?: unknown; error?: unknown }) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  };
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(result);
  chain.upsert.mockResolvedValue(result);
  chain.update.mockReturnValue(chain);
  // Supabase builders are awaitable after chained filters.
  Object.assign(chain, { then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) });
  return chain;
}

function setupSupabase() {
  const calendar = query({ data: null, error: null });
  const tasks = query({ data: null, error: null });
  const connection = query({ data: { id: "connection-1", encrypted_credentials: "dGVzdA==", settings: { scopes: ["calendar.readonly", "gmail.readonly"] } }, error: null });
  const profile = query({ data: { current_term_id: termId }, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from: vi.fn((table: string) => {
      if (table === "profiles") return profile;
      if (table === "integration_connections") return connection;
      if (table === "calendar_events") return calendar;
      if (table === "tasks") return tasks;
      throw new Error(`Unexpected table ${table}`);
    }),
  });
  return { calendar, tasks, connection };
}

describe("Google sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.createClient.mockReset();
    mocks.decryptCredentials.mockReturnValue({ accessToken: "token" });
    mocks.encryptCredentials.mockReturnValue("encrypted");
    setupSupabase();
  });

  it("keeps Calendar work and reports a Gmail rate limit as a partial HTTP 200 result", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("calendar")) return Promise.resolve(response({ items: [{ id: "event-1", summary: "Seminar", start: { dateTime: "2026-07-20T09:00:00Z" } }] }));
      return Promise.resolve(response({ error: { message: "Too many requests" } }, 429, { "Retry-After": "120" }));
    }));

    const result = await POST();
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toMatchObject({
      calendar: { state: "synced", imported: 1 },
      gmail: {
        state: "degraded",
        imported: 0,
        message: "Gmail is temporarily rate-limited. Your Calendar update is safe; try Gmail again after 2 minutes.",
      },
    });
  });

  it("caps Gmail metadata requests at three concurrent calls", async () => {
    let active = 0;
    let maximum = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("calendar")) return Promise.resolve(response({ items: [] }));
      if (url.includes("messages?")) return Promise.resolve(response({ messages: [1, 2, 3, 4, 5, 6].map((id) => ({ id: `gmail-${id}` })) }));
      active += 1;
      maximum = Math.max(maximum, active);
      return new Promise<Response>((resolve) => setTimeout(() => {
        active -= 1;
        resolve(response({ id: url.split("/").at(-1)?.split("?")[0], snippet: "Follow up", payload: { headers: [{ name: "Subject", value: "Review" }] } }));
      }, 5));
    }));

    const result = await POST();

    expect(result.status).toBe(200);
    expect(maximum).toBeLessThanOrEqual(3);
  });

  it("classifies reauthorization and missing Gmail scope without exposing provider payloads", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ error: { message: "expired" } }, 401))
      .mockResolvedValueOnce(response({ error: { message: "Request had insufficient authentication scopes." } }, 403)));

    await expect(googleApi({ accessToken: "token" }, "https://example.test/one", "Gmail")).rejects.toMatchObject<Partial<GoogleApiError>>({ kind: "needs_reauth" });
    await expect(googleApi({ accessToken: "token" }, "https://example.test/two", "Gmail")).rejects.toMatchObject<Partial<GoogleApiError>>({ kind: "permission", message: expect.stringContaining("Gmail read-only permission") });
  });
});
