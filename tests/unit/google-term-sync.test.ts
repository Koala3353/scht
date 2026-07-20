import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  googleApi: vi.fn(),
  decryptCredentials: vi.fn(),
  encryptCredentials: vi.fn(),
  tasksUpsert: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../lib/integrations/google", () => ({
  googleApi: mocks.googleApi,
  refreshGoogleCredential: vi.fn(),
}));
vi.mock("../../lib/integrations/credentials", () => ({
  decryptCredentials: mocks.decryptCredentials,
  encryptCredentials: mocks.encryptCredentials,
}));

import { POST } from "../../app/api/integrations/google/sync/route";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";

describe("Google sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decryptCredentials.mockReturnValue({ accessToken: "token" });
    mocks.encryptCredentials.mockReturnValue("encrypted");
    mocks.googleApi
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ messages: [{ id: "gmail-1" }] })
      .mockResolvedValueOnce({ id: "gmail-1", snippet: "Follow up", payload: { headers: [{ name: "Subject", value: "Assignment review notes" }] } });
    mocks.tasksUpsert.mockReturnValue({ select: vi.fn(async () => ({ data: [{ id: "task-1" }], error: null })) });
    const profileQuery = { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { current_term_id: termId }, error: null })) })) };
    const connectionQuery = { eq: vi.fn() };
    connectionQuery.eq.mockReturnValue(connectionQuery);
    Object.assign(connectionQuery, { then: (resolve: (value: { data: Array<{ id: string; account_email: string | null; encrypted_credentials: string; settings: Record<string, never> }>; error: null }) => unknown) => Promise.resolve({ data: [{ id: "connection-1", account_email: null, encrypted_credentials: "dGVzdA==", settings: {} }], error: null }).then(resolve) });
    const connectionUpdate = { eq: vi.fn(async () => ({ error: null })) };
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
      from: vi.fn((table: string) => {
        if (table === "profiles") return { select: vi.fn(() => profileQuery) };
        if (table === "integration_connections") return { select: vi.fn(() => connectionQuery), update: vi.fn(() => connectionUpdate) };
        if (table === "calendar_events") return { upsert: vi.fn(async () => ({ error: null })) };
        if (table === "tasks") return { upsert: mocks.tasksUpsert };
        throw new Error(`Unexpected table ${table}`);
      }),
    });
  });

  it("assigns Gmail review tasks to the selected current term", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.tasksUpsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ source: "gmail", term_id: termId }),
    ]), { onConflict: "user_id,source,source_id", ignoreDuplicates: true });
  });
});
