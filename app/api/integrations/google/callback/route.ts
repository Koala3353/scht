import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { decryptCredentials, encryptCredentials } from "../../../../../lib/integrations/credentials";
import { mergeGoogleCredential, type GoogleCredential } from "../../../../../lib/integrations/google";
import { createClient } from "../../../../../lib/supabase/server";

const pendingCookie = "scht-google-integration-pending";
const oauthTokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), expires_in: z.number().finite().positive() });
const googleIdentitySchema = z.object({ email: z.string().email(), email_verified: z.boolean().optional() });

function bytes(value: unknown) {
  if (typeof value === "string") return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return Buffer.from(value as Uint8Array);
}

function settingsRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function redirectToSettings(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete(pendingCookie);
  return response;
}

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const parsed = oauthTokenSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new Error("Google could not authorize this account.");
  return parsed.data;
}

async function googleEmail(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const parsed = googleIdentitySchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success || parsed.data.email_verified === false) throw new Error("Google did not return a verified account email.");
  return parsed.data.email.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const pending = request.cookies.get(pendingCookie)?.value;
  const separator = pending?.lastIndexOf(".") ?? -1;
  const expectedUserId = separator > 0 ? pending?.slice(0, separator) : null;
  const expectedState = separator > 0 ? pending?.slice(separator + 1) : null;
  if (!code || !state || !expectedUserId || !expectedState || state !== expectedState) return redirectToSettings(request, "/settings?integration=google-error");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== expectedUserId) return redirectToSettings(request, "/settings?integration=google-error");

  try {
    const redirectUri = new URL("/api/integrations/google/callback", request.nextUrl.origin).toString();
    const token = await exchangeGoogleCode(code, redirectUri);
    const accountEmail = await googleEmail(token.access_token);
    const { data: connections, error: readError } = await supabase
      .from("integration_connections")
      .select("id, account_key, account_email, encrypted_credentials, settings")
      .eq("user_id", user.id)
      .eq("provider", "google");
    if (readError) throw readError;
    const existing = (connections ?? []).find((connection) => connection.account_key === accountEmail)
      ?? (connections ?? []).find((connection) => connection.account_key === "legacy" && !connection.account_email);
    let previous: Pick<GoogleCredential, "refreshToken"> | undefined;
    try {
      if (existing?.encrypted_credentials) previous = { refreshToken: decryptCredentials(bytes(existing.encrypted_credentials)).refreshToken };
    } catch {
      // A fresh OAuth refresh token can replace unreadable legacy credentials.
    }
    const credentials = mergeGoogleCredential({ accessToken: token.access_token, ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}), expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString() }, previous);
    if (!credentials.refreshToken) throw new Error("Google did not return a refresh token.");
    const settings: Record<string, unknown> = { ...settingsRecord(existing?.settings), scopes: ["calendar.readonly", "gmail.readonly"] };
    delete settings.sync;
    const connectionPayload = {
      user_id: user.id,
      provider: "google",
      account_key: accountEmail,
      account_email: accountEmail,
      status: "connected",
      encrypted_credentials: encryptCredentials({ accessToken: credentials.accessToken, refreshToken: credentials.refreshToken, ...(credentials.expiresAt ? { expiresAt: credentials.expiresAt } : {}) }),
      settings,
      error_message: null,
      last_synced_at: null,
    };
    const result = existing
      ? await supabase.from("integration_connections").update(connectionPayload).eq("id", existing.id)
      : await supabase.from("integration_connections").insert(connectionPayload);
    if (result.error) throw result.error;
    return redirectToSettings(request, "/settings?integration=google-connected");
  } catch {
    return redirectToSettings(request, "/settings?integration=google-error");
  }
}
