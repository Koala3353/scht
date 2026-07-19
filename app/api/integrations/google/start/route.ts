import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const pendingCookie = 'scht-google-integration-pending';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/?error=authentication-required', request.url));

  const callbackUrl = new URL(
    '/auth/callback',
    process.env.NEXT_PUBLIC_APP_URL ?? request.url,
  ).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data.url) return NextResponse.redirect(new URL('/settings?integration=google-error', request.url));

  const response = NextResponse.redirect(data.url);
  response.cookies.set(pendingCookie, '1', {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
