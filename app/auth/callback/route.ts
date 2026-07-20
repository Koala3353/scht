import { NextRequest, NextResponse } from 'next/server';
import { encryptCredentials } from '@/lib/integrations/credentials';
import { createClient } from '@/lib/supabase/server';

const pendingCookie = 'scht-google-integration-pending';

function redirectTo(request: NextRequest, path: string, clearGooglePending = false) {
  const response = NextResponse.redirect(new URL(path, request.url));
  if (clearGooglePending) response.cookies.delete(pendingCookie);
  return response;
}

export async function GET(request: NextRequest) {
  const isGoogleIntegration = request.nextUrl.searchParams.get("integration") === "google" || request.cookies.get(pendingCookie)?.value === "1";
  const isAdminPortalSignIn = request.nextUrl.searchParams.get("next") === "/admin";
  const authFailurePath = (reason: string) => {
    if (isGoogleIntegration) return "/settings?integration=google-error";
    if (isAdminPortalSignIn) return `/admin/sign-in?error=${reason}`;
    return `/?error=${reason}`;
  };
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return redirectTo(request, authFailurePath("google-access-denied"), isGoogleIntegration);
  }
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return redirectTo(request, authFailurePath('missing-auth-code'), isGoogleIntegration);

  const supabase = await createClient();
  const { data: authData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectTo(request, authFailurePath('authentication-failed'), isGoogleIntegration);

  const user = authData.user;
  const session = authData.session;
  if (!user) return redirectTo(request, authFailurePath('authentication-failed'), isGoogleIntegration);

  const loadProfile = () =>
    supabase
      .from('profiles')
      .select('role, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

  let { data: profile, error: profileError } = await loadProfile();

  if (!profile && !profileError) {
    const { error: inviteError } = await supabase.rpc(
      'accept_invite_for_current_user',
    );
    if (inviteError) {
      await supabase.auth.signOut();
      return redirectTo(request, authFailurePath('workspace-access-check-failed'), isGoogleIntegration);
    }
    const recoveredProfile = await loadProfile();
    profile = recoveredProfile.data;
    profileError = recoveredProfile.error;
  }

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return redirectTo(request, authFailurePath('invite-required'), isGoogleIntegration);
  }

  if (isGoogleIntegration) {
    if (!session?.provider_token) return redirectTo(request, '/settings?integration=google-error', true);
    const credentials = encryptCredentials({
      accessToken: session.provider_token,
      ...(session.provider_refresh_token ? { refreshToken: session.provider_refresh_token } : {}),
      expiresAt: new Date(Date.now() + 3_300_000).toISOString(),
    });
    const { error: saveError } = await supabase
      .from('integration_connections')
      .upsert({
        user_id: user.id,
        provider: 'google',
        status: 'connected',
        encrypted_credentials: credentials,
        settings: { scopes: ['calendar.readonly', 'gmail.readonly'] },
        error_message: null,
        last_synced_at: null,
      }, { onConflict: 'user_id,provider' });
    return redirectTo(request, saveError ? '/settings?integration=google-error' : '/settings?integration=google-connected', true);
  }

  if (isAdminPortalSignIn) {
    if (profile.role !== 'owner_admin') {
      return redirectTo(request, '/admin/sign-in?error=not-owner');
    }
    return redirectTo(request, '/admin');
  }

  return redirectTo(request, profile.onboarding_completed_at ? '/today' : '/onboarding');
}
