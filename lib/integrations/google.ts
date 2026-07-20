import { z } from "zod";

export interface GoogleCredential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

/**
 * Google only sends a refresh token on some OAuth exchanges. Reconnecting
 * must therefore retain the one already stored for this account whenever the
 * callback provides a new access token without another refresh token.
 */
export function mergeGoogleCredential(next: GoogleCredential, previous?: Pick<GoogleCredential, "refreshToken">): GoogleCredential {
  return {
    accessToken: next.accessToken,
    ...(next.refreshToken || previous?.refreshToken ? { refreshToken: next.refreshToken || previous?.refreshToken } : {}),
    ...(next.expiresAt ? { expiresAt: next.expiresAt } : {}),
  };
}

export type GoogleErrorKind = "rate_limited" | "needs_reauth" | "permission" | "unavailable" | "unknown";

export class GoogleApiError extends Error {
  constructor(
    readonly kind: GoogleErrorKind,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

const errorPayloadSchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string().optional(), status: z.string().optional() })]).optional(),
});

function errorDetail(payload: unknown) {
  const parsed = errorPayloadSchema.safeParse(payload);
  if (!parsed.success) return "";
  return typeof parsed.data.error === "string" ? parsed.data.error : parsed.data.error?.message ?? "";
}

function retryAfterSeconds(header: string | null) {
  if (!header || !/^\d+$/.test(header.trim())) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

function permissionName(service: string) {
  return service === "Gmail" ? "Gmail read-only" : "Google Calendar read-only";
}

function classifiedError(service: string, status: number, payload: unknown, retryAfter: number | undefined) {
  const normalised = errorDetail(payload).toLowerCase();
  if (status === 401 || (status === 400 && normalised.includes("invalid_grant"))) return new GoogleApiError("needs_reauth", `${service} authorization has expired. Reconnect Google and try again.`);
  if (
    service === "Gmail" &&
    (
      normalised.includes("gmail api has not been used") ||
      normalised.includes("gmail api is disabled") ||
      normalised.includes("access not configured")
    )
  ) {
    return new GoogleApiError("unavailable", "Gmail API is not enabled for this Google Cloud project. An administrator must enable the Gmail API, then try again.");
  }
  if (status === 403 && (normalised.includes("insufficient authentication scopes") || normalised.includes("insufficient permission") || normalised.includes("required authentication credential"))) {
    return new GoogleApiError("permission", `${service} permission is missing. Reconnect Google and approve the ${permissionName(service)} permission.`);
  }
  if (status === 429 || normalised.includes("rate limit") || normalised.includes("quota exceeded")) return new GoogleApiError("rate_limited", `${service} is temporarily rate-limited.`, retryAfter);
  if (status >= 500 && status <= 599) return new GoogleApiError("unavailable", `${service} is temporarily unavailable. Try again shortly.`);
  return new GoogleApiError("unknown", `${service} could not be refreshed. Try again.`);
}

export function googleErrorKind(error: unknown): GoogleErrorKind {
  if (error instanceof GoogleApiError) return error.kind;
  return "unknown";
}

export function googleErrorMessage(error: unknown, service: string) {
  if (error instanceof GoogleApiError) return error.message;
  return `${service} could not be refreshed. Try again.`;
}

export function googleRetryAfter(error: unknown) {
  return error instanceof GoogleApiError ? error.retryAfterSeconds : undefined;
}

export function formatRetryAfter(seconds: number | undefined) {
  if (seconds === undefined) return "a few minutes";
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export async function googleApi<T>(credentials: GoogleCredential, url: string, service: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${credentials.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw classifiedError(service, response.status, payload, retryAfterSeconds(response.headers.get("Retry-After")));
  }
  return response.json() as Promise<T>;
}

export async function refreshGoogleCredential(credentials: GoogleCredential): Promise<GoogleCredential> {
  if (!credentials.refreshToken) throw new GoogleApiError("needs_reauth", "Google authorization has expired. Reconnect Google and try again.");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GoogleApiError("unknown", "Google could not be refreshed. Try again.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: credentials.refreshToken }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw classifiedError("Google authorization refresh", response.status, payload, retryAfterSeconds(response.headers.get("Retry-After")));
  }
  const body: unknown = await response.json();
  const parsed = z.object({ access_token: z.string().min(1), expires_in: z.number().finite().nonnegative() }).safeParse(body);
  if (!parsed.success) throw new GoogleApiError("unknown", "Google could not be refreshed. Try again.");
  return { accessToken: parsed.data.access_token, refreshToken: credentials.refreshToken, expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString() };
}
