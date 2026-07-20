export interface CanvasCourse { id: number; course_code?: string | null; name?: string | null; }
export interface CanvasAssignment {
  id: number;
  name?: string | null;
  due_at: string | null;
  points_possible: number | null;
  html_url?: string | null;
  description?: string | null;
  submission?: { workflow_state?: string | null; submitted_at?: string | null; excused?: boolean | null } | null;
}

function nextCanvasPage(linkHeader: string | null, origin: string) {
  const segment = linkHeader?.split(",").find((part) => /;\s*rel="?next"?/i.test(part));
  const target = segment?.match(/<([^>]+)>/)?.[1];
  if (!target) return null;
  const next = new URL(target, origin);
  if (next.origin !== origin || !next.pathname.startsWith("/api/v1/")) {
    throw new Error("Canvas returned an unsafe pagination link. Reconnect using your school’s Canvas URL.");
  }
  return next.toString();
}

function canvasFailure(status: number) {
  if (status === 401) return "Canvas token is invalid or has expired. Create a new personal access token, then reconnect.";
  if (status === 403) return "Canvas accepted the token but denied access. Confirm it belongs to this Canvas site and has course access.";
  if (status === 404) return "Canvas could not find this site. Check the base URL and remove any API path.";
  if (status === 429) return "Canvas is temporarily rate-limited. Try again in a few minutes.";
  if (status >= 500) return "Canvas is temporarily unavailable. Try again shortly.";
  return "Canvas request failed (" + status + "). Check the base URL and access token.";
}

export async function canvasApi<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const origin = new URL(baseUrl).origin;
  let requestUrl = origin + "/api/v1" + path;
  const visited = new Set<string>();
  const paginated: unknown[] = [];

  for (let page = 0; page < 50; page += 1) {
    if (visited.has(requestUrl)) throw new Error("Canvas returned a repeated pagination link. Try syncing again later.");
    visited.add(requestUrl);
    const response = await fetch(requestUrl, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (!response.ok) throw new Error(canvasFailure(response.status));
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return body as T;
    paginated.push(...body);
    const next = nextCanvasPage(response.headers.get("Link"), origin);
    if (!next) return paginated as T;
    requestUrl = next;
  }

  throw new Error("Canvas returned too many pages. Narrow the selected courses and try again.");
}
