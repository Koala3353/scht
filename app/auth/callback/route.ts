import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const pendingCookie = 'scht-google-integration-pending';

function logAdminAuthDiagnostic(
  enabled: boolean,
  stage: string,
  details: Record<string, boolean | string | null>,
) {
  if (!enabled) return;
  console.info('admin-auth-diagnostic', { stage, ...details });
}

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
  if (!user) return redirectTo(request, authFailurePath('authentication-failed'), isGoogleIntegration);

  logAdminAuthDiagnostic(isAdminPortalSignIn, 'session-exchanged', {
    userId: user.id,
    supabaseHost: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? request.url).host,
  });

  // The session exchange has already authenticated `user.id`. Use the
  // server-only client for this access check so an RLS policy failure cannot
  // turn an existing owner profile into an invite-required response.
  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch {
    logAdminAuthDiagnostic(isAdminPortalSignIn, 'profile-client-unavailable', {
      serviceClientCreated: false,
    });
    await supabase.auth.signOut();
    return redirectTo(
      request,
      authFailurePath('workspace-access-check-failed'),
      isGoogleIntegration,
    );
  }
  const loadProfile = () =>
    adminSupabase
      .from('profiles')
      .select('role, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

  let { data: profile, error: profileError } = await loadProfile();
  logAdminAuthDiagnostic(isAdminPortalSignIn, 'profile-read', {
    profileFound: Boolean(profile),
    profileRole: profile?.role ?? null,
    profileErrorCode: profileError?.code ?? null,
    profileErrorMessage: profileError?.message ?? null,
  });

  if (profileError) {
    await supabase.auth.signOut();
    return redirectTo(
      request,
      authFailurePath('workspace-access-check-failed'),
      isGoogleIntegration,
    );
  }

  if (!profile) {
    const { error: inviteError } = await supabase.rpc(
      'accept_invite_for_current_user',
    );
    logAdminAuthDiagnostic(isAdminPortalSignIn, 'invite-recovery', {
      inviteErrorCode: inviteError?.code ?? null,
      inviteErrorMessage: inviteError?.message ?? null,
    });
    if (inviteError) {
      await supabase.auth.signOut();
      return redirectTo(request, authFailurePath('workspace-access-check-failed'), isGoogleIntegration);
    }
    const recoveredProfile = await loadProfile();
    profile = recoveredProfile.data;
    profileError = recoveredProfile.error;
    logAdminAuthDiagnostic(isAdminPortalSignIn, 'profile-recovery-read', {
      profileFound: Boolean(profile),
      profileRole: profile?.role ?? null,
      profileErrorCode: profileError?.code ?? null,
      profileErrorMessage: profileError?.message ?? null,
    });
  }

  if (profileError) {
    await supabase.auth.signOut();
    return redirectTo(
      request,
      authFailurePath('workspace-access-check-failed'),
      isGoogleIntegration,
    );
  }

  if (!profile) {
    await supabase.auth.signOut();
    return redirectTo(request, authFailurePath('invite-required'), isGoogleIntegration);
  }

  if (isGoogleIntegration) {
    // Google data connections now use their dedicated callback, so that adding
    // another Google identity never replaces the current Scht sign-in session.
    return redirectTo(request, '/settings?integration=google-error', true);
  }

  if (isAdminPortalSignIn) {
    if (profile.role !== 'owner_admin') {
      return redirectTo(request, '/admin/sign-in?error=not-owner');
    }
    return redirectTo(request, '/admin');
  }

  return redirectTo(request, profile.onboarding_completed_at ? '/today' : '/onboarding');
}
