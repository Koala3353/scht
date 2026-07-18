export interface CanvasCourse { id: number; course_code: string; name: string; }
export interface CanvasAssignment { id: number; name: string; due_at: string | null; points_possible: number | null; html_url: string; description: string | null; }

export async function canvasApi<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const origin = new URL(baseUrl).origin;
  const response = await fetch(`${origin}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Canvas request failed (${response.status}). Check the base URL and access token.`);
  return response.json() as Promise<T>;
}
