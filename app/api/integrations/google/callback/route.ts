import { NextRequest, NextResponse } from "next/server";

import { decryptCredentials, encryptCredentials } from "@/lib/integrations/credentials";
import { mergeGoogleCredential, type GoogleCredential } from "@/lib/integrations/google";
import { createClient } from "@/lib/supabase/server";

const pendingCookie = "scht-google-integration-pending";

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

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectToSettings(request, "/settings?integration=google-error");

  const expectedUserId = request.cookies.get(pendingCookie)?.value;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data.user;
  const session = data.session;
  if (error || !user || !session?.provider_token) return redirectToSettings(request, "/settings?integration=google-error");
  if (expectedUserId && expectedUserId !== user.id) {
    await supabase.auth.signOut();
    return redirectToSettings(request, "/settings?integration=google-error");
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("integration_connections")
      .select("encrypted_credentials, settings")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();
    if (existingError) throw existingError;
    let previous: Pick<GoogleCredential, "refreshToken"> | undefined;
    try {
      if (existing?.encrypted_credentials) previous = { refreshToken: decryptCredentials(bytes(existing.encrypted_credentials)).refreshToken };
    } catch {
      // A new OAuth refresh token below is enough to replace unreadable legacy credentials.
    }
    const merged = mergeGoogleCredential({
      accessToken: session.provider_token,
      ...(session.provider_refresh_token ? { refreshToken: session.provider_refresh_token } : {}),
      expiresAt: new Date(Date.now() + 3_300_000).toISOString(),
    }, previous);
    if (!merged.refreshToken) throw new Error("Google did not return a refresh token.");
    const preservedSettings = { ...settingsRecord(existing?.settings) };
    delete preservedSettings.sync;
    const { error: saveError } = await supabase
      .from("integration_connections")
      .upsert({
        user_id: user.id,
        provider: "google",
        status: "connected",
        encrypted_credentials: encryptCredentials({ accessToken: merged.accessToken, ...(merged.refreshToken ? { refreshToken: merged.refreshToken } : {}), ...(merged.expiresAt ? { expiresAt: merged.expiresAt } : {}) }),
        settings: { ...preservedSettings, scopes: ["calendar.readonly", "gmail.readonly"] },
        error_message: null,
        last_synced_at: null,
      }, { onConflict: "user_id,provider" });
    return redirectToSettings(request, saveError ? "/settings?integration=google-error" : "/settings?integration=google-connected");
  } catch {
    return redirectToSettings(request, "/settings?integration=google-error");
  }
}
