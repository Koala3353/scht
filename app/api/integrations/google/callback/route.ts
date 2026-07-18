import { NextRequest, NextResponse } from 'next/server';
import { encryptCredentials } from '@/lib/integrations/credentials';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/settings?integration=google-error', request.url));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data.user;
  const session = data.session;
  if (error || !user || !session?.provider_token) return NextResponse.redirect(new URL('/settings?integration=google-error', request.url));
  const credentials = encryptCredentials({ accessToken: session.provider_token, ...(session.provider_refresh_token ? { refreshToken: session.provider_refresh_token } : {}), expiresAt: new Date(Date.now() + 3_300_000).toISOString() });
  const { error: saveError } = await supabase.from('integration_connections').upsert({ user_id: user.id, provider: 'google', status: 'connected', encrypted_credentials: credentials, settings: { scopes: ['calendar.readonly', 'gmail.readonly'] }, error_message: null, last_synced_at: null }, { onConflict: 'user_id,provider' });
  return NextResponse.redirect(new URL(saveError ? '/settings?integration=google-error' : '/settings?integration=google-connected', request.url));
}
