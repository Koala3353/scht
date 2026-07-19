export interface GoogleCredential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

type GoogleErrorPayload = {
  error?: string | { message?: string; status?: string };
};

function helpfulGoogleError(service: string, status: number, payload: GoogleErrorPayload) {
  const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
  const normalised = (detail ?? "").toLowerCase();
  if (status === 401) return service + " authorization has expired. Reconnect Google and try again.";
  if (status === 403 && (normalised.includes("insufficient authentication scopes") || normalised.includes("insufficient permission"))) {
    return service + " permission was not granted. Select Reconnect Google, approve both Calendar and Gmail read-only permissions, then sync again.";
  }
  if (status === 403 && (normalised.includes("has not been used") || normalised.includes("disabled") || normalised.includes("not enabled"))) {
    return service + " API is not enabled in the Google Cloud project. Enable it, wait a few minutes, then reconnect Google.";
  }
  if (status === 403) return service + " access was rejected by Google" + (detail ? ": " + detail.slice(0, 220) : ".") + "";
  return service + " request failed (" + status + "). Reconnect Google and try again.";
}

export async function googleApi<T>(credentials: GoogleCredential, url: string, service: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: "Bearer " + credentials.accessToken },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as GoogleErrorPayload;
    throw new Error(helpfulGoogleError(service, response.status, payload));
  }
  return response.json() as Promise<T>;
}

export async function refreshGoogleCredential(credentials: GoogleCredential): Promise<GoogleCredential> {
  if (!credentials.refreshToken) throw new Error("Google connection needs reauthorization.");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth server credentials are required to refresh this connection.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: credentials.refreshToken }),
  });
  if (!response.ok) throw new Error("Google connection needs reauthorization.");
  const body = await response.json() as { access_token: string; expires_in: number };
  return { accessToken: body.access_token, refreshToken: credentials.refreshToken, expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString() };
}
