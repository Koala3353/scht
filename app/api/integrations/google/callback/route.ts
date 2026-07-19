import { NextRequest, NextResponse } from "next/server";

import { encryptCredentials } from "@/lib/integrations/credentials";
import { createClient } from "@/lib/supabase/server";

const pendingCookie = "scht-google-integration-pending";

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
    const credentials = encryptCredentials({
      accessToken: session.provider_token,
      ...(session.provider_refresh_token ? { refreshToken: session.provider_refresh_token } : {}),
      expiresAt: new Date(Date.now() + 3_300_000).toISOString(),
    });
    const { error: saveError } = await supabase
      .from("integration_connections")
      .upsert({
        user_id: user.id,
        provider: "google",
        status: "connected",
        encrypted_credentials: credentials,
        settings: { scopes: ["calendar.readonly", "gmail.readonly"] },
        error_message: null,
        last_synced_at: null,
      }, { onConflict: "user_id,provider" });
    return redirectToSettings(request, saveError ? "/settings?integration=google-error" : "/settings?integration=google-connected");
  } catch {
    return redirectToSettings(request, "/settings?integration=google-error");
  }
}
