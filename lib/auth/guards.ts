import { forbidden, redirect } from 'next/navigation';

import { createClient } from '../supabase/server';

export type UserRole = 'member' | 'owner_admin';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

interface AuthRedirectOptions {
  unauthenticatedRedirect?: string;
  unauthorizedRedirect?: string;
  accessCheckFailureRedirect?: string;
}

export async function requireUser(
  options: AuthRedirectOptions = {},
): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(options.unauthenticatedRedirect ?? '/');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    if (options.accessCheckFailureRedirect) {
      redirect(options.accessCheckFailureRedirect);
    }
    if (options.unauthorizedRedirect) redirect(options.unauthorizedRedirect);
    forbidden();
  }

  const role = profile?.role;
  if (role !== 'member' && role !== 'owner_admin') {
    if (options.unauthorizedRedirect) redirect(options.unauthorizedRedirect);
    forbidden();
  }

  return { id: user.id, role };
}

export async function requireOwnerAdmin(
  options: AuthRedirectOptions = {},
): Promise<AuthenticatedUser> {
  const user = await requireUser(options);

  if (user.role !== 'owner_admin') {
    if (options.unauthorizedRedirect) redirect(options.unauthorizedRedirect);
    forbidden();
  }

  return user;
}
