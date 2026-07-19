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
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=missing-auth-code', isGoogleIntegration);

  const supabase = await createClient();
  const { data: authData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=authentication-failed', isGoogleIntegration);

  const user = authData.user;
  const session = authData.session;
  if (!user) return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=authentication-failed', isGoogleIntegration);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=access-denied', isGoogleIntegration);

  if (profile.role !== 'owner_admin') {
    const { data: accepted, error: inviteError } = await supabase.rpc('accept_invite_for_current_user');
    if (inviteError) return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=invite-required', isGoogleIntegration);

    if (!accepted) {
      const email = user.email?.trim().toLowerCase();
      const { data: invite, error: inviteLookupError } = email
        ? await supabase
            .from('invites')
            .select('accepted_by, accepted_at')
            .eq('normalized_email', email)
            .maybeSingle()
        : { data: null, error: new Error('Missing account email.') };

      if (inviteLookupError || invite?.accepted_by !== user.id || !invite.accepted_at) {
        await supabase.auth.signOut();
        return redirectTo(request, isGoogleIntegration ? '/settings?integration=google-error' : '/?error=invite-required', isGoogleIntegration);
      }
    }
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

  return redirectTo(request, profile.onboarding_completed_at ? '/today' : '/onboarding');
}
