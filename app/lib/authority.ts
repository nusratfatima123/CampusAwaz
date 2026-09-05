import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import { AUTHORITY_REQUESTABLE_ROLES, roleLabel } from './roles';
import type {
  AuthorityRequest,
  AuthorityRequestStatus,
  RoleName,
} from '@/types/database';

/**
 * Server-side authority request management.
 *
 * SERVER ONLY — every function uses the service-role client. Ownership and
 * permission checks are performed explicitly since the service role bypasses
 * RLS.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateAuthorityRequestInput {
  userId: string;
  universityId: string;
  roleId: string;
  departmentId?: string | null;
  statement: string;
  evidencePath?: string | null;
}

export interface AuthorityRequestFilters {
  universityId?: string;
  status?: AuthorityRequestStatus;
  userId?: string;
  roleId?: string;
}

export interface AuthorityDirectoryEntry {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role_name: RoleName;
  role_label: string;
  department_id: string | null;
  department_name: string | null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createAuthorityRequest(
  input: CreateAuthorityRequestInput,
  request?: Request,
): Promise<{ request: AuthorityRequest | null; error?: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('authority_requests')
    .insert({
      user_id: input.userId,
      university_id: input.universityId,
      role_id: input.roleId,
      department_id: input.departmentId ?? null,
      statement: input.statement,
      evidence_path: input.evidencePath ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { request: null, error: 'You already have a request for this role.' };
    }
    console.error('[authority] create request failed:', error.message);
    return { request: null, error: 'Failed to create request.' };
  }

  await audit(AUDIT_EVENTS.AUTHORITY_REQUEST_CREATED, {
    userId: input.userId,
    actor: 'user',
    metadata: {
      request_id: data.id,
      role_id: input.roleId,
      university_id: input.universityId,
    },
    request,
  });

  return { request: data as AuthorityRequest };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getAuthorityRequests(
  filters: AuthorityRequestFilters = {},
): Promise<AuthorityRequest[]> {
  const admin = createAdminClient();

  let query = admin
    .from('authority_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.universityId) {
    query = query.eq('university_id', filters.universityId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.roleId) {
    query = query.eq('role_id', filters.roleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[authority] get requests failed:', error.message);
    return [];
  }
  return (data as AuthorityRequest[]) ?? [];
}

export async function getAuthorityRequest(
  id: string,
): Promise<AuthorityRequest | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('authority_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[authority] get request failed:', error.message);
    return null;
  }
  return data as AuthorityRequest;
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

export async function approveAuthorityRequest(
  requestId: string,
  adminUserId: string,
  reason?: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getAuthorityRequest(requestId);
  if (!existing) {
    return { success: false, error: 'Request not found.' };
  }
  if (existing.status !== 'pending') {
    return { success: false, error: 'Request is not pending.' };
  }
  if (existing.reviewed_by === adminUserId || existing.user_id === adminUserId) {
    return { success: false, error: 'Cannot approve your own request.' };
  }

  const { error: updateError } = await admin
    .from('authority_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      review_reason: reason ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[authority] approve failed:', updateError.message);
    return { success: false, error: 'Failed to approve request.' };
  }

  const { error: roleError } = await admin.from('user_roles').insert({
    user_id: existing.user_id,
    role_id: existing.role_id,
    university_id: existing.university_id,
  });

  if (roleError && roleError.code !== '23505') {
    console.error('[authority] role insert failed:', roleError.message);
  }

  await audit(AUDIT_EVENTS.AUTHORITY_REQUEST_APPROVED, {
    userId: adminUserId,
    actor: 'admin',
    metadata: {
      request_id: requestId,
      target_user_id: existing.user_id,
      role_id: existing.role_id,
    },
    request,
  });

  await createNotification({
    userId: existing.user_id,
    type: 'case_update',
    title: 'Authority Request Approved',
    body: `Your authority request has been approved.${reason ? ` Reason: ${reason}` : ''}`,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectAuthorityRequest(
  requestId: string,
  adminUserId: string,
  reason: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getAuthorityRequest(requestId);
  if (!existing) {
    return { success: false, error: 'Request not found.' };
  }
  if (existing.status !== 'pending') {
    return { success: false, error: 'Request is not pending.' };
  }
  if (existing.user_id === adminUserId) {
    return { success: false, error: 'Cannot reject your own request.' };
  }

  const { error } = await admin
    .from('authority_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      review_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    console.error('[authority] reject failed:', error.message);
    return { success: false, error: 'Failed to reject request.' };
  }

  await audit(AUDIT_EVENTS.AUTHORITY_REQUEST_REJECTED, {
    userId: adminUserId,
    actor: 'admin',
    metadata: {
      request_id: requestId,
      target_user_id: existing.user_id,
      reason,
    },
    request,
  });

  await createNotification({
    userId: existing.user_id,
    type: 'case_update',
    title: 'Authority Request Rejected',
    body: `Your authority request has been rejected. Reason: ${reason}`,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

export async function suspendAuthority(
  userId: string,
  roleId: string,
  adminUserId: string,
  reason: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: roleRow } = await admin
    .from('roles')
    .select('name')
    .eq('id', roleId)
    .single();

  if (!roleRow || !AUTHORITY_REQUESTABLE_ROLES.includes(roleRow.name as RoleName)) {
    return { success: false, error: 'Invalid role for suspension.' };
  }

  const { data: existingRequest } = await admin
    .from('authority_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .in('status', ['approved', 'reinstated'])
    .maybeSingle();

  if (!existingRequest) {
    return { success: false, error: 'No active authority request found.' };
  }

  const { error: roleDeleteError } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId);

  if (roleDeleteError) {
    console.error('[authority] role delete failed:', roleDeleteError.message);
  }

  const { error: updateError } = await admin
    .from('authority_requests')
    .update({
      status: 'suspended',
      suspended_by: adminUserId,
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
    })
    .eq('id', existingRequest.id);

  if (updateError) {
    console.error('[authority] suspend failed:', updateError.message);
    return { success: false, error: 'Failed to suspend authority.' };
  }

  await audit(AUDIT_EVENTS.AUTHORITY_SUSPENDED, {
    userId: adminUserId,
    actor: 'admin',
    metadata: {
      target_user_id: userId,
      role_id: roleId,
      reason,
    },
    request,
  });

  await createNotification({
    userId,
    type: 'case_update',
    title: 'Authority Suspended',
    body: `Your authority has been suspended. Reason: ${reason}`,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reinstate
// ---------------------------------------------------------------------------

export async function reinstateAuthority(
  requestId: string,
  adminUserId: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getAuthorityRequest(requestId);
  if (!existing) {
    return { success: false, error: 'Request not found.' };
  }
  if (existing.status !== 'suspended') {
    return { success: false, error: 'Request is not suspended.' };
  }

  const { error: updateError } = await admin
    .from('authority_requests')
    .update({
      status: 'reinstated',
      suspended_by: null,
      suspension_reason: null,
      suspended_at: null,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[authority] reinstate update failed:', updateError.message);
    return { success: false, error: 'Failed to reinstate authority.' };
  }

  const { error: roleError } = await admin.from('user_roles').insert({
    user_id: existing.user_id,
    role_id: existing.role_id,
    university_id: existing.university_id,
  });

  if (roleError && roleError.code !== '23505') {
    console.error('[authority] role re-insert failed:', roleError.message);
  }

  await audit(AUDIT_EVENTS.AUTHORITY_REINSTATED, {
    userId: adminUserId,
    actor: 'admin',
    metadata: {
      request_id: requestId,
      target_user_id: existing.user_id,
      role_id: existing.role_id,
    },
    request,
  });

  await createNotification({
    userId: existing.user_id,
    type: 'case_update',
    title: 'Authority Reinstated',
    body: 'Your authority has been reinstated. You now have access to your previous role.',
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export async function getAuthorityDirectory(
  universityId: string,
): Promise<AuthorityDirectoryEntry[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_roles')
    .select(`
      user_id,
      role_id,
      university_id,
      profiles!user_roles_user_id_fkey ( full_name, phone ),
      roles ( name ),
      departments ( name )
    `)
    .eq('university_id', universityId)
    .in('role_id',
      (await admin
        .from('roles')
        .select('id')
        .in('name' as any, AUTHORITY_REQUESTABLE_ROLES as any))
        .data?.map((r) => r.id) ?? []
    );

  if (error) {
    console.error('[authority] directory fetch failed:', error.message);
    return [];
  }

  type RawRow = {
    user_id: string;
    role_id: string;
    university_id: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
    roles: { name: string } | null;
    departments: { name: string | null } | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((row) => ({
    user_id: row.user_id,
    full_name: row.profiles?.full_name ?? null,
    phone: row.profiles?.phone ?? null,
    role_name: (row.roles?.name ?? 'student') as RoleName,
    role_label: roleLabel(row.roles?.name ?? 'student'),
    department_id: null,
    department_name: row.departments?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

export async function canRequestAuthority(
  userId: string,
  roleName: RoleName,
): Promise<{ eligible: boolean; reason?: string }> {
  if (!AUTHORITY_REQUESTABLE_ROLES.includes(roleName)) {
    return { eligible: false, reason: 'This role cannot be requested.' };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('affiliation_status, university_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || profile.affiliation_status !== 'verified') {
    return { eligible: false, reason: 'You must be a verified user to request authority.' };
  }
  if (!profile.university_id) {
    return { eligible: false, reason: 'No university associated with your profile.' };
  }

  const { data: roleIdRow } = await admin
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single();

  if (!roleIdRow) {
    return { eligible: false, reason: 'Role not found.' };
  }

  const { data: existing } = await admin
    .from('authority_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('role_id', roleIdRow.id)
    .eq('university_id', profile.university_id)
    .in('status', ['pending', 'approved', 'reinstated'])
    .maybeSingle();

  if (existing && existing.status === 'pending') {
    return { eligible: false, reason: 'You already have a pending request for this role.' };
  }
  if (existing && (existing.status === 'approved' || existing.status === 'reinstated')) {
    return { eligible: false, reason: 'You already hold this authority.' };
  }

  return { eligible: true };
}
