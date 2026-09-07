import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import type {
  IdentityAccessRequest,
  IdentityAccessRequestStatus,
  RoleName,
} from '@/types/database';

/**
 * Server-side identity access request management.
 *
 * Workflow:
 *   1. Authority (staff) requests identity access → status = 'pending'
 *   2. Admin approves or denies → 'admin_approved' | 'admin_denied'
 *   3. Student grants or denies → 'granted' | 'denied'
 *   4. On grant, the requester is added to complaint_privacy.exposed_to
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns all identity access requests for a complaint, newest first.
 */
export async function getIdentityRequestsForComplaint(
  complaintId: string,
): Promise<IdentityAccessRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('identity_access_requests')
    .select(
      'id, complaint_id, requester_id, requested_by_role, reason, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at',
    )
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[identity-access] list failed:', error.message);
    return [];
  }

  return (data ?? []) as IdentityAccessRequest[];
}

/**
 * Returns a single request by id, or null.
 */
export async function getIdentityRequest(
  requestId: string,
): Promise<IdentityAccessRequest | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('identity_access_requests')
    .select(
      'id, complaint_id, requester_id, requested_by_role, reason, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at',
    )
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    console.error('[identity-access] fetch failed:', error.message);
    return null;
  }

  return (data as IdentityAccessRequest) ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface RequestIdentityAccessInput {
  complaintId: string;
  requesterId: string;
  role: RoleName;
  reason: string;
}

/**
 * Creates a new identity access request. Returns the request or an error
 * message when one already exists.
 */
export async function requestIdentityAccess(
  input: RequestIdentityAccessInput,
  request?: Request,
): Promise<{ request: IdentityAccessRequest | null; error?: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('identity_access_requests')
    .insert({
      complaint_id: input.complaintId,
      requester_id: input.requesterId,
      requested_by_role: input.role,
      reason: input.reason,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        request: null,
        error: 'An active identity access request already exists for this complaint.',
      };
    }
    console.error('[identity-access] create failed:', error.message);
    return { request: null, error: 'Failed to create identity access request.' };
  }

  const created = data as IdentityAccessRequest;

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_REQUESTED, {
    userId: input.requesterId,
    actor: 'user',
    metadata: {
      request_id: created.id,
      complaint_id: input.complaintId,
      role: input.role,
      reason: input.reason,
    },
    request,
  });

  // Notify the student that an authority has requested access to their identity.
  const { data: complaint } = await admin
    .from('complaints')
    .select('student_id, tracking_id')
    .eq('id', input.complaintId)
    .maybeSingle();

  if (complaint) {
    await createNotification({
      userId: complaint.student_id,
      type: 'case_update',
      complaintId: input.complaintId,
      trackingId: complaint.tracking_id,
      title: 'Identity access requested',
      body: `An authority has requested access to your identity. Reason: ${input.reason}`,
    });
  }

  return { request: created };
}

// ---------------------------------------------------------------------------
// Admin decision
// ---------------------------------------------------------------------------

/**
 * Admin approves an identity access request. Moves status to 'admin_approved'
 * and notifies the student.
 */
export async function approveIdentityRequest(
  requestId: string,
  adminId: string,
  notes?: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getIdentityRequest(requestId);
  if (!existing) return { success: false, error: 'Request not found.' };
  if (existing.status !== 'pending') {
    return { success: false, error: 'Request is no longer pending.' };
  }

  const { error } = await admin
    .from('identity_access_requests')
    .update({
      status: 'admin_approved',
      admin_decided_by: adminId,
      admin_decided_at: new Date().toISOString(),
      admin_notes: notes ?? null,
    })
    .eq('id', requestId);

  if (error) {
    console.error('[identity-access] admin approve failed:', error.message);
    return { success: false, error: 'Failed to approve request.' };
  }

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_ADMIN_APPROVED, {
    userId: adminId,
    actor: 'admin',
    metadata: { request_id: requestId, complaint_id: existing.complaint_id },
    request,
  });

  // Notify the student that admin approved — they now need to grant/deny.
  const { data: complaint } = await admin
    .from('complaints')
    .select('student_id, tracking_id')
    .eq('id', existing.complaint_id)
    .maybeSingle();

  if (complaint) {
    await createNotification({
      userId: complaint.student_id,
      type: 'case_update',
      complaintId: existing.complaint_id,
      trackingId: complaint.tracking_id,
      title: 'Identity access — admin approved',
      body: 'An admin has approved a staff request to see your identity. You can now grant or deny it.',
    });
  }

  return { success: true };
}

/**
 * Admin denies an identity access request. Moves status to 'admin_denied'.
 */
export async function denyIdentityRequest(
  requestId: string,
  adminId: string,
  notes?: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getIdentityRequest(requestId);
  if (!existing) return { success: false, error: 'Request not found.' };
  if (existing.status !== 'pending') {
    return { success: false, error: 'Request is no longer pending.' };
  }

  const { error } = await admin
    .from('identity_access_requests')
    .update({
      status: 'admin_denied',
      admin_decided_by: adminId,
      admin_decided_at: new Date().toISOString(),
      admin_notes: notes ?? null,
    })
    .eq('id', requestId);

  if (error) {
    console.error('[identity-access] admin deny failed:', error.message);
    return { success: false, error: 'Failed to deny request.' };
  }

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_ADMIN_DENIED, {
    userId: adminId,
    actor: 'admin',
    metadata: { request_id: requestId, complaint_id: existing.complaint_id },
    request,
  });

  // Notify the requester that admin denied.
  await createNotification({
    userId: existing.requester_id,
    type: 'case_update',
    complaintId: existing.complaint_id,
    title: 'Identity access denied',
    body: 'Your request to access the reporter\'s identity was denied by an admin.',
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Student decision
// ---------------------------------------------------------------------------

/**
 * Student grants the identity access request. Adds the requester to
 * complaint_privacy.exposed_to and moves status to 'granted'.
 */
export async function grantIdentityRequest(
  requestId: string,
  studentNotes?: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getIdentityRequest(requestId);
  if (!existing) return { success: false, error: 'Request not found.' };
  if (existing.status !== 'pending' && existing.status !== 'admin_approved') {
    return { success: false, error: 'Request is not awaiting your decision.' };
  }

  const now = new Date().toISOString();

  // Add requester to exposed_to in complaint_privacy.
  const { data: privacy } = await admin
    .from('complaint_privacy')
    .select('id, exposed_to')
    .eq('complaint_id', existing.complaint_id)
    .maybeSingle();

  if (privacy) {
    const currentExposed = (privacy.exposed_to ?? []) as string[];
    if (!currentExposed.includes(existing.requester_id)) {
      const { error: privacyError } = await admin
        .from('complaint_privacy')
        .update({ exposed_to: [...currentExposed, existing.requester_id] })
        .eq('id', privacy.id);

      if (privacyError) {
        console.error('[identity-access] failed to update exposed_to:', privacyError.message);
        return { success: false, error: 'Failed to grant identity access.' };
      }
    }
  }

  const { error } = await admin
    .from('identity_access_requests')
    .update({
      status: 'granted',
      student_decided_at: now,
      student_notes: studentNotes ?? null,
      granted_at: now,
    })
    .eq('id', requestId);

  if (error) {
    console.error('[identity-access] grant failed:', error.message);
    return { success: false, error: 'Failed to grant identity access.' };
  }

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_GRANTED, {
    userId: existing.requester_id,
    actor: 'user',
    metadata: {
      request_id: requestId,
      complaint_id: existing.complaint_id,
      granted_to: existing.requester_id,
    },
    request,
  });

  // Notify the requester that identity was revealed.
  await createNotification({
    userId: existing.requester_id,
    type: 'case_update',
    complaintId: existing.complaint_id,
    title: 'Identity access granted',
    body: 'The student has granted your request. You can now see the reporter\'s identity.',
  });

  return { success: true };
}

/**
 * Student denies the identity access request. Moves status to 'denied'.
 */
export async function denyIdentityRequestByStudent(
  requestId: string,
  studentNotes?: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const existing = await getIdentityRequest(requestId);
  if (!existing) return { success: false, error: 'Request not found.' };
  if (existing.status !== 'pending' && existing.status !== 'admin_approved') {
    return { success: false, error: 'Request is not awaiting your decision.' };
  }

  const { error } = await admin
    .from('identity_access_requests')
    .update({
      status: 'denied',
      student_decided_at: new Date().toISOString(),
      student_notes: studentNotes ?? null,
    })
    .eq('id', requestId);

  if (error) {
    console.error('[identity-access] student deny failed:', error.message);
    return { success: false, error: 'Failed to deny identity access.' };
  }

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_DENIED, {
    userId: existing.requester_id,
    actor: 'user',
    metadata: { request_id: requestId, complaint_id: existing.complaint_id },
    request,
  });

  // Notify the requester that student denied.
  await createNotification({
    userId: existing.requester_id,
    type: 'case_update',
    complaintId: existing.complaint_id,
    title: 'Identity access denied',
    body: 'The student has denied your request to access their identity.',
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Looks up the role id for a given role name. Returns null when not found.
 */
async function getRoleId(roleName: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('roles')
    .select('id')
    .eq('name', roleName as never)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
