import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return redirectTo(request, '/?error=missing-auth-code');

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectTo(request, '/?error=authentication-failed');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return redirectTo(request, '/?error=authentication-failed');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) return redirectTo(request, '/?error=access-denied');

  if (profile.role !== 'owner_admin') {
    const { data: accepted, error: inviteError } = await supabase.rpc('accept_invite_for_current_user');
    if (inviteError || !accepted) {
      await supabase.auth.signOut();
      return redirectTo(request, '/?error=invite-required');
    }
  }

  return redirectTo(request, profile.onboarding_completed_at ? '/today' : '/onboarding');
}
