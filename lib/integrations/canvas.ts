export interface CanvasCourse { id: number; course_code: string; name: string; }
export interface CanvasAssignment { id: number; name: string; due_at: string | null; points_possible: number | null; html_url: string; description: string | null; }

export async function canvasApi<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const origin = new URL(baseUrl).origin;
  const response = await fetch(`${origin}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Canvas token is invalid or has expired. Create a new personal access token, then reconnect.");
    if (response.status === 403) throw new Error("Canvas accepted the token but denied access. Confirm it belongs to this Canvas site and has course access.");
    if (response.status === 404) throw new Error("Canvas could not find this site. Check the base URL and remove any API path.");
    throw new Error("Canvas request failed (" + response.status + "). Check the base URL and access token.");
  }
  return response.json() as Promise<T>;
}
