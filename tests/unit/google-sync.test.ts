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
import { googleApi, GoogleApiError, refreshGoogleCredential } from "../../lib/integrations/google";

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
  chain.upsert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  // Supabase builders are awaitable after chained filters.
  Object.assign(chain, { then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) });
  return chain;
}

function setupSupabase(connectionRows = [{ id: "connection-1", account_email: "student@example.com", encrypted_credentials: "dGVzdA==", settings: { scopes: ["calendar.readonly", "gmail.readonly"] } }]) {
  const calendar = query({ data: null, error: null });
  const tasks = query({ data: null, error: null });
  const connection = query({ data: connectionRows, error: null });
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
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
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

  it("does not schedule Gmail metadata IDs that remain after a classified failure", async () => {
    const requestedIds: string[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("calendar")) return Promise.resolve(response({ items: [] }));
      if (url.includes("messages?")) return Promise.resolve(response({ messages: [1, 2, 3, 4, 5, 6].map((id) => ({ id: `gmail-${id}` })) }));
      const id = url.split("/").at(-1)?.split("?")[0] ?? "";
      requestedIds.push(id);
      if (id === "gmail-1") return Promise.resolve(response({ error: { message: "Too many requests" } }, 429));
      return new Promise<Response>((resolve) => setTimeout(() => resolve(response({ id, snippet: "Follow up", payload: { headers: [{ name: "Subject", value: "Review" }] } })), 5));
    }));

    const result = await POST();

    expect(result.status).toBe(200);
    expect(requestedIds).toEqual(expect.arrayContaining(["gmail-1", "gmail-2", "gmail-3"]));
    expect(requestedIds).not.toEqual(expect.arrayContaining(["gmail-4", "gmail-5", "gmail-6"]));
  });

  it("reports only Gmail rows returned as newly persisted", async () => {
    const { tasks } = setupSupabase();
    tasks.select.mockImplementation(() => ({ then: (resolve: (value: { data: Array<{ id: string }>; error: null }) => unknown) => Promise.resolve({ data: [{ id: "new-task" }], error: null }).then(resolve) }));
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("calendar")) return Promise.resolve(response({ items: [] }));
      if (url.includes("messages?")) return Promise.resolve(response({ messages: [{ id: "gmail-1" }, { id: "gmail-2" }] }));
      const id = url.split("/").at(-1)?.split("?")[0];
      return Promise.resolve(response({ id, snippet: "Follow up", payload: { headers: [{ name: "Subject", value: "Assignment review" }] } }));
    }));

    const result = await POST();
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toMatchObject({ gmail: { state: "synced", imported: 1 } });
    expect(tasks.upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: "user_id,source,source_id", ignoreDuplicates: true });
  });

  it("syncs every linked Google account with account-scoped provider IDs", async () => {
    const { calendar, tasks } = setupSupabase([
      { id: "connection-1", account_email: "student@example.com", encrypted_credentials: "dGVzdA==", settings: {} },
      { id: "connection-2", account_email: "school@example.edu", encrypted_credentials: "dGVzdA==", settings: {} },
    ]);
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("calendar")) return Promise.resolve(response({ items: [{ id: "event-1", summary: "Seminar", start: { dateTime: "2026-07-20T09:00:00Z" } }] }));
      if (url.includes("messages?")) return Promise.resolve(response({ messages: [{ id: "gmail-1" }] }));
      return Promise.resolve(response({ id: "gmail-1", snippet: "Follow up", payload: { headers: [{ name: "Subject", value: "Assignment review" }] } }));
    }));

    const result = await POST();
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.accounts).toHaveLength(2);
    expect(body.calendar).toMatchObject({ state: "synced", imported: 2 });
    expect(calendar.upsert.mock.calls.flatMap(([events]) => (events as Array<{ source_id: string }>).map((event) => event.source_id)))
      .toEqual(expect.arrayContaining(["connection-1:event-1", "connection-2:event-1"]));
    expect(tasks.upsert.mock.calls.flatMap(([tasks]) => (tasks as Array<{ source_id: string }>).map((task) => task.source_id)))
      .toEqual(expect.arrayContaining(["connection-1:gmail-1", "connection-2:gmail-1"]));
  });

  it("keeps the connection retryable when token refresh is rate-limited", async () => {
    const { connection } = setupSupabase();
    mocks.decryptCredentials.mockReturnValue({ accessToken: "expired", refreshToken: "refresh-token", expiresAt: "2026-07-01T00:00:00.000Z" });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response({ error: "slow down" }, 429, { "Retry-After": "120" }))));

    const result = await POST();
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toMatchObject({
      calendar: { state: "degraded", message: "Google authorization refresh is temporarily rate-limited. Try again after 2 minutes." },
      gmail: { state: "degraded", message: "Google authorization refresh is temporarily rate-limited. Try again after 2 minutes." },
    });
    expect(connection.update).toHaveBeenCalledWith(expect.objectContaining({ status: "connected", error_message: null }));
  });

  it("classifies a token-refresh 5xx as retryable rather than reauthorization", async () => {
    const { connection } = setupSupabase();
    mocks.decryptCredentials.mockReturnValue({ accessToken: "expired", refreshToken: "refresh-token", expiresAt: "2026-07-01T00:00:00.000Z" });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response({ error: "unavailable" }, 503))));

    const result = await POST();
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toMatchObject({ calendar: { state: "degraded" }, gmail: { state: "degraded" } });
    expect(connection.update).toHaveBeenCalledWith(expect.objectContaining({ status: "connected", error_message: null }));
    await expect(refreshGoogleCredential({ accessToken: "expired", refreshToken: "refresh-token" })).rejects.toMatchObject<Partial<GoogleApiError>>({ kind: "unavailable" });
  });

  it("classifies reauthorization and missing Gmail scope without exposing provider payloads", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ error: { message: "expired" } }, 401))
      .mockResolvedValueOnce(response({ error: { message: "Request had insufficient authentication scopes." } }, 403)));

    await expect(googleApi({ accessToken: "token" }, "https://example.test/one", "Gmail")).rejects.toMatchObject<Partial<GoogleApiError>>({ kind: "needs_reauth" });
    await expect(googleApi({ accessToken: "token" }, "https://example.test/two", "Gmail")).rejects.toMatchObject<Partial<GoogleApiError>>({ kind: "permission", message: expect.stringContaining("Gmail read-only permission") });
  });

  it("explains when Gmail is disabled while Calendar remains available", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response({
      error: { message: "Gmail API has not been used in project 123 before or it is disabled." },
    }, 403))));

    await expect(googleApi({ accessToken: "token" }, "https://example.test/gmail", "Gmail")).rejects.toMatchObject<Partial<GoogleApiError>>({
      kind: "unavailable",
      message: expect.stringContaining("Gmail API is not enabled"),
    });
  });
});
