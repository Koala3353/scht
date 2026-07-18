import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type UserRole = 'member' | 'owner_admin';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

function forbidden(message = 'Forbidden'): never {
  throw new Response(message, { status: 403 });
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (profileError || (role !== 'member' && role !== 'owner_admin')) {
    return forbidden('Profile is unavailable.');
  }

  return { id: user.id, role };
}

export async function requireOwnerAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (user.role !== 'owner_admin') {
    return forbidden();
  }

  return user;
}
