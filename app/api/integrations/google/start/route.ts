import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "../../../../../lib/supabase/server";

const pendingCookie = "scht-google-integration-pending";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/?error=authentication-required", request.url));

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/settings?integration=google-error", request.url));
  const state = randomBytes(32).toString("base64url");
  const forceConsent = request.nextUrl.searchParams.get("consent") === "1";
  const callbackUrl = new URL("/api/integrations/google/callback", request.nextUrl.origin);
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl.toString(),
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    // Normal linking reuses the durable server-side refresh token. Consent is
    // only forced when a user deliberately reconnects a broken account.
    prompt: forceConsent ? "consent select_account" : "select_account",
    include_granted_scopes: "true",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(pendingCookie, `${user.id}.${state}`, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
