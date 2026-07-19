import { afterEach, describe, expect, it, vi } from "vitest";

import { canvasApi } from "../../lib/integrations/canvas";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Canvas API client", () => {
  it("follows same-origin next links and combines paginated results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), {
        headers: {
          Link: '<https://canvas.example.edu/api/v1/courses?page=2>; rel="next"',
          "content-type": "application/json",
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }]), {
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(canvasApi<Array<{ id: number }>>(
      "https://canvas.example.edu",
      "token",
      "/courses?per_page=100",
    )).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects pagination links that could expose a Canvas token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), {
      headers: {
        Link: '<https://untrusted.example/api/v1/courses?page=2>; rel="next"',
        "content-type": "application/json",
      },
    })));

    await expect(canvasApi("https://canvas.example.edu", "token", "/courses")).rejects.toThrow(
      "unsafe pagination link",
    );
  });
});
