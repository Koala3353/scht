import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  canvasApi: vi.fn(),
  canvasErrorKind: vi.fn(() => "retryable"),
  decryptCredentials: vi.fn(),
  encryptCredentials: vi.fn(),
  subjectsInsert: vi.fn(),
  tasksUpdate: vi.fn(),
  tasksUpsert: vi.fn(),
  assignmentDetailsUpsert: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../lib/integrations/canvas", () => ({ canvasApi: mocks.canvasApi, canvasErrorKind: mocks.canvasErrorKind }));
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

function setupSync(errorAt: "subjects" | "tasks" | "connection" | null, existingSourceIds: string[] = [], assignments: Array<Record<string, unknown>> | null = null) {
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
  const subjectMutation = (error: boolean) => ({ select: vi.fn(async () => ({ data: error ? null : [{ id: "saved", canvas_course_id: "42" }], error: error ? { message: "database down" } : null })) });
  const ignoredDuplicateMutation = { select: vi.fn(async () => ({ data: [], error: null })) };
  const tasksTable = {
    upsert: mocks.tasksUpsert.mockImplementation(() => existingSourceIds.length ? ignoredDuplicateMutation : mutation(errorAt === "tasks")),
    update: mocks.tasksUpdate.mockImplementation(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => ({ is: vi.fn(async () => ({ error: null })) })) })) })) })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [{ id: "saved", source_id: "42:1" }], error: null })),
        })),
      })),
    })),
  };
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: vi.fn(() => profileQuery) };
      if (table === "integration_connections") return {
        select: vi.fn(() => connectionQuery),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: errorAt === "connection" ? { message: "database down" } : null })) })),
      };
      if (table === "subjects") return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })) })),
        insert: mocks.subjectsInsert.mockImplementation(() => subjectMutation(errorAt === "subjects")),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "saved", canvas_course_id: "42" }, error: null })) })) })) })),
      };
      if (table === "tasks") return tasksTable;
      if (table === "canvas_assignment_details") return {
        upsert: mocks.assignmentDetailsUpsert.mockResolvedValue({ error: null }),
      };
      throw new Error(`Unexpected table ${table}`);
    }),
  });
  mocks.decryptCredentials.mockReturnValue({ baseUrl: "https://canvas.example.edu", token: "valid-token" });
  mocks.canvasApi.mockImplementation(async (_baseUrl: string, _token: string, path: string) => {
    if (path.startsWith("/courses?")) return [{ id: 42, course_code: "TEST-42", name: "Testing" }];
    return assignments ?? [{ id: 1, name: "Assignment", due_at: null, points_possible: null, html_url: "https://canvas.example.edu/courses/42/assignments/1", description: "Description" }];
  });
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

  it("preserves a manually edited Canvas task when a refresh sees its source identity", async () => {
    setupSync(null, ["42:1"]);

    const response = await POST(syncRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ assignments: 0 });
    // The import never writes an existing source identity, so its description,
    // deadline, project, completion state, and canonical revision stay intact.
    expect(mocks.tasksUpsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: "user_id,source,source_id", ignoreDuplicates: true });
  });

  it("does not turn a duplicate concurrent source into a Canvas sync failure", async () => {
    setupSync(null);
    let insertAttempt = 0;
    mocks.tasksUpsert.mockImplementation(() => ({ select: vi.fn(async () => ({ data: insertAttempt++ === 0 ? [{ id: "saved" }] : [], error: null })) }));

    const [first, second] = await Promise.all([POST(syncRequest()), POST(syncRequest())]);
    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(firstBody.assignments + secondBody.assignments).toBe(1);
    expect(mocks.tasksUpsert).toHaveBeenCalledTimes(2);
  });

  it("uses Canvas IDs and manual-course matching instead of an expression-index upsert", async () => {
    setupSync(null);
    const response = await POST(syncRequest());

    expect(response.status).toBe(200);
    expect(mocks.subjectsInsert).toHaveBeenCalledWith(expect.any(Array));
  });

  it("does not create tasks for submitted Canvas assignments and closes prior imported copies", async () => {
    setupSync(null, [], [{ id: 1, name: "Submitted assignment", due_at: null, points_possible: null, submission: { workflow_state: "graded", submitted_at: "2026-07-20T10:00:00.000Z" } }]);

    const response = await POST(syncRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ assignments: 0 });
    expect(mocks.tasksUpsert).not.toHaveBeenCalled();
    expect(mocks.tasksUpdate).toHaveBeenCalledWith(expect.objectContaining({ completed_at: expect.any(String) }));
  });
});
