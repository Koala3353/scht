import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  canvasApi: vi.fn(),
  decryptCredentials: vi.fn(),
  encryptCredentials: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../lib/integrations/canvas", () => ({ canvasApi: mocks.canvasApi }));
vi.mock("../../lib/integrations/credentials", () => ({
  decryptCredentials: mocks.decryptCredentials,
  encryptCredentials: mocks.encryptCredentials,
}));
import {
  normalizeCanvasBaseUrl,
  validCanvasToken,
} from "../../lib/validation/canvas-input";
import { POST } from "../../app/api/integrations/canvas/route";

const userId = "0f0d1d8d-4d3b-4d97-b9e3-5f2d6e2a9b4f";
const termId = "f8e5cb4d-2dd4-4d63-a9d1-5af4c3b1d7f0";

function syncRequest() {
  return new Request("https://scht.test/api/integrations/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "sync" }),
  });
}

function setupSync(errorAt: "subjects" | "tasks" | "connection" | null) {
  const connectionQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: { id: "connection-1", encrypted_credentials: "dGVzdA==" }, error: null })),
  };
  connectionQuery.eq.mockReturnValue(connectionQuery);
  const profileQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: { current_term_id: termId }, error: null })),
  };
  profileQuery.eq.mockReturnValue(profileQuery);
  const mutation = (error: boolean) => ({ select: vi.fn(async () => ({ data: error ? null : [{ id: "saved" }], error: error ? { message: "database down" } : null })) });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: vi.fn(() => profileQuery) };
      if (table === "integration_connections") return {
        select: vi.fn(() => connectionQuery),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: errorAt === "connection" ? { message: "database down" } : null })) })),
      };
      if (table === "subjects") return { upsert: vi.fn(() => mutation(errorAt === "subjects")), select: vi.fn(() => subjectsQuery) };
      if (table === "tasks") return { upsert: vi.fn(() => mutation(errorAt === "tasks")) };
      throw new Error(`Unexpected table ${table}`);
    }),
  });
  mocks.decryptCredentials.mockReturnValue({ baseUrl: "https://canvas.example.edu", token: "valid-token" });
  mocks.canvasApi.mockImplementation(async (_baseUrl: string, _token: string, path: string) => path.startsWith("/courses?")
    ? [{ id: 42, course_code: "TEST-42", name: "Testing" }]
    : [{ id: 1, name: "Assignment", due_at: null, points_possible: null, html_url: "https://canvas.example.edu/courses/42/assignments/1", description: "Description" }]);
}

describe("Canvas connection input", () => {
  it("normalizes a secure Canvas URL and rejects unsafe targets", () => {
    expect(normalizeCanvasBaseUrl(" https://canvas.ateneo.edu/ ")).toBe(
      "https://canvas.ateneo.edu",
    );
    expect(normalizeCanvasBaseUrl("http://canvas.ateneo.edu")).toBeNull();
    expect(normalizeCanvasBaseUrl("https://localhost:3000")).toBeNull();
    expect(
      normalizeCanvasBaseUrl("https://user:pass@canvas.ateneo.edu"),
    ).toBeNull();
  });

  it("requires a plausibly sized personal access token", () => {
    expect(validCanvasToken("too-short")).toBe(true);
    expect(validCanvasToken("short")).toBe(false);
    expect(validCanvasToken("x".repeat(4097))).toBe(false);
  });
});

describe("Canvas sync persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["subjects", "tasks", "connection"] as const)("does not report success when %s persistence fails", async (errorAt) => {
    setupSync(errorAt);

    const response = await POST(syncRequest());

    expect(response.status).not.toBe(200);
  });

  it("reports only records confirmed by Supabase", async () => {
    setupSync(null);
    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ courses: 1, assignments: 1 });
  });
});
