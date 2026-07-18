export interface GoogleCredential { accessToken: string; refreshToken?: string; expiresAt?: string; }

export async function googleApi<T>(credentials: GoogleCredential, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${credentials.accessToken}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Google API request failed (${response.status}). Reconnect Google and try again.`);
  return response.json() as Promise<T>;
}

export async function refreshGoogleCredential(credentials: GoogleCredential): Promise<GoogleCredential> {
  if (!credentials.refreshToken) throw new Error('Google connection needs reauthorization.');
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth server credentials are required to refresh this connection.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: credentials.refreshToken }) });
  if (!response.ok) throw new Error('Google connection needs reauthorization.');
  const body = await response.json() as { access_token: string; expires_in: number; };
  return { accessToken: body.access_token, refreshToken: credentials.refreshToken, expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString() };
}
