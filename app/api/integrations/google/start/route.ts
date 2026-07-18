import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/?error=authentication-required', request.url));
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/api/integrations/google/callback', request.url).toString(), scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly', queryParams: { access_type: 'offline', prompt: 'consent' } } });
  if (error || !data.url) return NextResponse.redirect(new URL('/settings?integration=google-error', request.url));
  return NextResponse.redirect(data.url);
}
