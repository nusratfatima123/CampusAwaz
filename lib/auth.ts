import { cache } from 'react';
import { createClient } from './supabase/server';
import type {
  ProfileWithUniversity,
  RoleName,
  UserVerification,
} from '@/types/database';
import type { User } from '@supabase/supabase-js';

/**
 * Session/user helpers for Server Components and Route Handlers.
 * `cache()` de-duplicates the work across a single render pass.
 */

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

export const getProfile = cache(async (): Promise<ProfileWithUniversity | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, university_id, affiliation_status, student_type, privacy_mode, created_at, updated_at, universities ( id, name, code, allowed_email_domains )'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[auth] failed to load profile:', error.message);
    return null;
  }

  return (data as ProfileWithUniversity | null) ?? null;
});

export const getUserRoles = cache(async (): Promise<RoleName[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', user.id);

  if (error) {
    console.error('[auth] failed to load roles:', error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as { roles: { name: RoleName } | null }[];
  return rows.map((row) => row.roles?.name).filter((n): n is RoleName => Boolean(n));
});

export type VerificationSummary = Pick<
  UserVerification,
  | 'id'
  | 'method'
  | 'status'
  | 'email_used'
  | 'needs_manual_review'
  | 'ocr_extracted'
  | 'ocr_confidence'
  | 'reviewer_notes'
  | 'verified_at'
  | 'rejected_at'
  | 'created_at'
>;

export const getVerifications = cache(async (): Promise<VerificationSummary[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_verification')
    .select(
      'id, method, status, email_used, needs_manual_review, ocr_extracted, ocr_confidence, reviewer_notes, verified_at, rejected_at, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[auth] failed to load verifications:', error.message);
    return [];
  }

  return (data ?? []) as VerificationSummary[];
});

/** Everything the auth shell needs, in one call. */
export async function getAuthContext() {
  const [user, profile, roles, verifications] = await Promise.all([
    getUser(),
    getProfile(),
    getUserRoles(),
    getVerifications(),
  ]);

  return { user, profile, roles, verifications };
}

/** Display name preference: profile name → email local part → 'Student'. */
export function displayName(
  profile: Pick<ProfileWithUniversity, 'full_name'> | null,
  user: User | null
): string {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  const email = user?.email;
  if (email) {
    const local = email.split('@')[0];
    if (local) return local;
  }
  return 'Student';
}
