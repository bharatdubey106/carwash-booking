'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validation/schemas';

export type AuthActionState = {
  error: string | null;
};

const GENERIC_AUTH_ERROR = 'Invalid email or password.';

/**
 * Shared login routine. Verifies credentials against Supabase Auth, then
 * enforces that the authenticated profile's role matches the portal being
 * accessed. On role mismatch the session is torn down immediately so a
 * client account can never retain a live session on an owner/admin route.
 */
async function loginWithRole(
  formData: FormData,
  requiredRole: 'owner' | 'admin'
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_AUTH_ERROR };
  }

  const supabase = await createClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError || !signInData.user) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', signInData.user.id)
    .single();

  if (profileError || !profile || profile.role !== requiredRole) {
    // Credentials were valid but this account has no business in this portal.
    // Never leave an authenticated session behind for the wrong role.
    await supabase.auth.signOut();
    return { error: GENERIC_AUTH_ERROR };
  }

  revalidatePath('/', 'layout');
  redirect(requiredRole === 'owner' ? '/owner/dashboard' : '/admin/dashboard');
}

export async function signInOwner(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return loginWithRole(formData, 'owner');
}

export async function signInAdmin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return loginWithRole(formData, 'admin');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}