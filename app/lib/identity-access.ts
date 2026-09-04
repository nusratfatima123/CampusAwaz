import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import { CATEGORY_AUTHORITY_MAP, IDENTITY_ACCESS_GRANT_HOURS } from './constants';
import type {
  Complaint,
  ComplaintPrivacy,
  IdentityAccessRequest,
  IdentityAccessRequestStatus,
  RoleName,
} from '@/types/database';

/**
 * Server-side identity access request workflow.
 *
 * Flow: authority requests → admin approves/denies → student grants/denies →
 * only then can the assigned authority see minimum identity info.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// Expire stale grants
// ---------------------------------------------------------------------------

/**
 * Sets status to 'expired' for any 'granted' row where expires_at has passed.
 * Called at the start of canAccessIdentity() to keep the gate accurate.
 */
async function expireStaleRequests(complaintId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: stale } = await admin
    .from('identity_access_requests')
    .select('id, complaint_id, requester_id')
    .eq('complaint_id', complaintId)
    .eq('status', 'granted')
    .lt('expires_at', now);

  if (!stale || stale.length === 0) return;

  const ids = stale.map((r) => r.id);
  await admin
    .from('identity_access_requests')
    .update({ status: 'expired' })
    .in('id', ids);

  for (const row of stale) {
    await audit(AUDIT_EVENTS.IDENTITY_ACCESS_EXPIRED, {
      userId: row.requester_id,
      actor: 'system',
      metadata: { request_id: row.id, complaint_id: row.complaint_id },
    });
  }
}

// ---------------------------------------------------------------------------
// Request identity access
// ---------------------------------------------------------------------------

/**
 * An assigned authority requests access to the student's identity.
 * Validates assignment, role affinity, and no duplicate active request.
 */
export async function requestIdentityAccess(
  complaintId: string,
  requesterId: string,
  roles: RoleName[],
  request?: Request,
): Promise<IdentityAccessRequest> {
  const admin = createAdminClient();

  const { data: complaint, error } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, privacy_mode, assigned_to, category_id, is_sensitive')
    .eq('id', complaintId)
    .maybeSingle();

  if (error || !complaint) throw new Error('Complaint not found.');
  const c = complaint as unknown as Complaint;

  if (c.assigned_to !== requesterId) {
    throw new Error('You are not assigned to this complaint.');
  }

  if (c.privacy_mode === 'identified') {
    throw new Error('Identity is already visible for this complaint.');
  }

  const { data: catRow } = await admin
    .from('complaint_categories')
    .select('key')
    .eq('id', c.category_id ?? '')
    .maybeSingle();

  const categoryKey = (catRow as { key: string } | null)?.key ?? 'other';
  const allowedRoles = CATEGORY_AUTHORITY_MAP[categoryKey] ?? CATEGORY_AUTHORITY_MAP.other ?? [];

  const requesterRole = roles.find((r) => allowedRoles.includes(r));
  if (!requesterRole) {
    throw new Error('Your role is not authorized for this complaint category.');
  }

  const { data: existing } = await admin
    .from('identity_access_requests')
    .select('id')
    .eq('complaint_id', complaintId)
    .in('status', ['pending', 'admin_approved', 'granted'])
    .maybeSingle();

  if (existing) {
    throw new Error('An active identity access request already exists for this complaint.');
  }

  const { data: inserted, error: insertError } = await admin
    .from('identity_access_requests')
    .insert({
      complaint_id: complaintId,
      requester_id: requesterId,
      requested_by_role: requesterRole,
      status: 'pending',
    })
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to create identity request: ${insertError?.message}`);
  }

  const identityRequest = inserted as unknown as IdentityAccessRequest;

  const { data: requesterProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', requesterId)
    .maybeSingle();

  const requesterName = (requesterProfile as { full_name: string | null } | null)?.full_name ?? 'A staff member';

  const { data: adminUsers } = await admin
    .from('user_roles')
    .select('user_id, roles ( name )')
    .eq('university_id', c.university_id ?? '');

  const adminUserIds = ((adminUsers ?? []) as unknown as { user_id: string; roles: { name: string } | null }[])
    .filter((r) => r.roles?.name === 'admin')
    .map((r) => r.user_id);

  for (const adminId of adminUserIds) {
    await createNotification({
      userId: adminId,
      type: 'identity_request',
      complaintId,
      title: 'Identity access request pending review',
      body: `${requesterName} has requested access to the identity of the reporter in complaint ${c.tracking_id}.`,
      trackingId: c.tracking_id,
    }, request);
  }

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_REQUESTED, {
    userId: requesterId,
    actor: 'user',
    metadata: {
      complaint_id: complaintId,
      tracking_id: c.tracking_id,
      request_id: identityRequest.id,
      role: requesterRole,
    },
    request,
  });

  return identityRequest;
}

// ---------------------------------------------------------------------------
// Admin decision
// ---------------------------------------------------------------------------

/**
 * Admin approves or denies an identity access request.
 */
export async function adminDecideIdentityRequest(
  requestId: string,
  adminId: string,
  approve: boolean,
  notes?: string,
  request?: Request,
): Promise<IdentityAccessRequest> {
  const admin = createAdminClient();

  const { data: reqRow, error } = await admin
    .from('identity_access_requests')
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !reqRow) throw new Error('Identity request not found.');
  const req = reqRow as unknown as IdentityAccessRequest;

  if (req.status !== 'pending') {
    throw new Error(`Cannot decide on a request with status "${req.status}".`);
  }

  const newStatus: IdentityAccessRequestStatus = approve ? 'admin_approved' : 'admin_denied';

  const { data: updated, error: updateError } = await admin
    .from('identity_access_requests')
    .update({
      status: newStatus,
      admin_decided_by: adminId,
      admin_decided_at: new Date().toISOString(),
      admin_notes: notes ?? null,
    })
    .eq('id', requestId)
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update identity request: ${updateError?.message}`);
  }

  const identityRequest = updated as unknown as IdentityAccessRequest;

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id')
    .eq('id', req.complaint_id)
    .maybeSingle();

  const trackingId = (complaint as { tracking_id: string; student_id: string } | null)?.tracking_id ?? '';

  if (approve && complaint) {
    await createNotification({
      userId: (complaint as { student_id: string }).student_id,
      type: 'identity_request',
      complaintId: req.complaint_id,
      title: 'Identity access request — your action needed',
      body: `An admin has approved a request to reveal your identity for complaint ${trackingId}. Please review and grant or deny.`,
      trackingId,
    }, request);
  }

  if (!approve) {
    await createNotification({
      userId: req.requester_id,
      type: 'identity_request',
      complaintId: req.complaint_id,
      title: 'Identity access request denied',
      body: `Your request to access the reporter's identity for complaint ${trackingId} has been denied by an admin.${notes ? ` Reason: ${notes}` : ''}`,
      trackingId,
    }, request);
  }

  await audit(
    approve ? AUDIT_EVENTS.IDENTITY_ACCESS_ADMIN_APPROVED : AUDIT_EVENTS.IDENTITY_ACCESS_ADMIN_DENIED,
    {
      userId: adminId,
      actor: 'admin',
      metadata: {
        request_id: requestId,
        complaint_id: req.complaint_id,
        tracking_id: trackingId,
        decision: approve ? 'approved' : 'denied',
        notes,
      },
      request,
    },
  );

  return identityRequest;
}

// ---------------------------------------------------------------------------
// Student decision
// ---------------------------------------------------------------------------

/**
 * Student grants or denies an admin-approved identity access request.
 * On grant: sets status to 'granted', records timestamps, adds requester to exposed_to.
 */
export async function studentDecideIdentityRequest(
  requestId: string,
  studentId: string,
  approve: boolean,
  notes?: string,
  request?: Request,
): Promise<IdentityAccessRequest> {
  const admin = createAdminClient();

  const { data: reqRow, error } = await admin
    .from('identity_access_requests')
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !reqRow) throw new Error('Identity request not found.');
  const req = reqRow as unknown as IdentityAccessRequest;

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, privacy_mode')
    .eq('id', req.complaint_id)
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  const c = complaint as { id: string; tracking_id: string; student_id: string; privacy_mode: string };

  if (c.student_id !== studentId) {
    throw new Error('Only the complaint owner can decide on this request.');
  }

  if (req.status !== 'admin_approved') {
    throw new Error(`Cannot decide on a request with status "${req.status}".`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDENTITY_ACCESS_GRANT_HOURS * 60 * 60 * 1000);

  const newStatus: IdentityAccessRequestStatus = approve ? 'granted' : 'denied';

  const updateData: Record<string, unknown> = {
    status: newStatus,
    student_decided_at: now.toISOString(),
    student_notes: notes ?? null,
  };

  if (approve) {
    updateData.granted_at = now.toISOString();
    updateData.expires_at = expiresAt.toISOString();
  }

  const { data: updated, error: updateError } = await admin
    .from('identity_access_requests')
    .update(updateData as Partial<IdentityAccessRequest>)
    .eq('id', requestId)
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update identity request: ${updateError?.message}`);
  }

  const identityRequest = updated as unknown as IdentityAccessRequest;

  if (approve) {
    const { data: privacyRow } = await admin
      .from('complaint_privacy')
      .select('id, exposed_to')
      .eq('complaint_id', req.complaint_id)
      .maybeSingle();

    const privacy = privacyRow as { id: string; exposed_to: string[] } | null;
    const currentExposed = privacy?.exposed_to ?? [];

    if (!currentExposed.includes(req.requester_id)) {
      await admin
        .from('complaint_privacy')
        .update({ exposed_to: [...currentExposed, req.requester_id] })
        .eq('complaint_id', req.complaint_id);
    }
  }

  await createNotification({
    userId: req.requester_id,
    type: 'identity_request',
    complaintId: req.complaint_id,
    title: approve ? 'Identity access granted' : 'Identity access denied',
    body: approve
      ? `The student has granted your identity access request for complaint ${c.tracking_id}. Access expires in ${IDENTITY_ACCESS_GRANT_HOURS} hours.`
      : `The student has denied your identity access request for complaint ${c.tracking_id}.${notes ? ` Reason: ${notes}` : ''}`,
    trackingId: c.tracking_id,
  }, request);

  await audit(
    approve ? AUDIT_EVENTS.IDENTITY_ACCESS_STUDENT_GRANTED : AUDIT_EVENTS.IDENTITY_ACCESS_STUDENT_DENIED,
    {
      userId: studentId,
      actor: 'user',
      metadata: {
        request_id: requestId,
        complaint_id: req.complaint_id,
        tracking_id: c.tracking_id,
        decision: approve ? 'granted' : 'denied',
        notes,
      },
      request,
    },
  );

  return identityRequest;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns all identity access requests for a complaint, newest first. */
export async function getIdentityRequestsForComplaint(
  complaintId: string,
): Promise<IdentityAccessRequest[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('identity_access_requests')
    .select('id, complaint_id, requester_id, requested_by_role, status, admin_decided_by, admin_decided_at, admin_notes, student_decided_at, student_notes, granted_at, expires_at, created_at, updated_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[identity-access] failed to load requests:', error.message);
    return [];
  }

  return (data ?? []) as unknown as IdentityAccessRequest[];
}

/**
 * 8-condition security gate: can the given user see the identity of the
 * reporter for this complaint?
 *
 * Returns true only when all conditions are met.
 */
export async function canAccessIdentity(
  complaintId: string,
  userId: string,
): Promise<boolean> {
  await expireStaleRequests(complaintId);

  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, privacy_mode, assigned_to')
    .eq('id', complaintId)
    .maybeSingle();

  if (!complaint) return false;
  const c = complaint as unknown as Complaint;

  // Condition 1: privacy must be anonymous or confidential
  if (c.privacy_mode !== 'anonymous' && c.privacy_mode !== 'confidential') return false;

  // Condition 2: caller must be the assigned authority
  if (c.assigned_to !== userId) return false;

  // Condition 3-7: find a granted, non-expired, non-superseded request
  const now = new Date().toISOString();
  const { data: requests } = await admin
    .from('identity_access_requests')
    .select('id, requester_id, requested_by_role, status, granted_at, expires_at, created_at')
    .eq('complaint_id', complaintId)
    .eq('status', 'granted')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const rows = (requests ?? []) as unknown as IdentityAccessRequest[];
  if (rows.length === 0) return false;

  const req = rows[0];
  if (!req) return false;

  // Condition 4: granted_at is not null
  if (!req.granted_at) return false;

  // Condition 5: expires_at is not null
  if (!req.expires_at) return false;

  // Condition 6: not expired
  if (now >= req.expires_at) return false;

  // Condition 7: not superseded — this is the latest granted request
  const { data: newer } = await admin
    .from('identity_access_requests')
    .select('id')
    .eq('complaint_id', complaintId)
    .eq('requester_id', userId)
    .eq('status', 'granted')
    .gt('created_at', req.created_at)
    .limit(1);

  if (newer && (newer as { id: string }[]).length > 0) return false;

  // Condition 8: role hasn't changed since the request
  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', userId);

  const currentRoles = ((roleRows ?? []) as unknown as { roles: { name: string } | null }[])
    .map((r) => r.roles?.name)
    .filter((n): n is string => Boolean(n));

  if (!currentRoles.includes(req.requested_by_role)) return false;

  await audit(AUDIT_EVENTS.IDENTITY_ACCESS_USED, {
    userId,
    actor: 'user',
    metadata: {
      complaint_id: complaintId,
      request_id: req.id,
    },
  });

  return true;
}
