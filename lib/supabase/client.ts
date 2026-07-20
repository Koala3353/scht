'use client';

import { createBrowserClient } from '@supabase/ssr';

function getBrowserSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing browser Supabase environment variables.');
  }

  return { url, anonKey };
}

export function createClient() {
  const { url, anonKey } = getBrowserSupabaseEnvironment();
  return createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
