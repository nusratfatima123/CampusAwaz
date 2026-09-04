import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import { SENSITIVE_HANDLER_ROLES, getEvidenceSignedUrls } from './complaints';
import { getSlaDisplay } from './escalation';
import { getIdentityRequestsForComplaint } from './identity-access';
import { SLA_APPROACHING_THRESHOLD } from './constants';
import type {
  AiRecommendation,
  Complaint,
  ComplaintAssignment,
  ComplaintEvidence,
  ComplaintPriority,
  ComplaintPrivacy,
  ComplaintStatus,
  ComplaintStatusHistory,
  ComplaintWithCategory,
  Department,
  Escalation,
  Feedback,
  IdentityAccessRequest,
  NotificationType,
  PrivacyMode,
  ProofOfAction,
  ResolutionEvidence,
  RoleName,
  SlaDisplay,
  SlaRule,
  SlaState,
} from '@/types/database';

/**
 * Server-side complaint management: listing, detail, assignment, status changes.
 *
 * SERVER ONLY — every function uses the service-role client. Ownership and role
 * checks are performed here since the service role bypasses RLS.
 */

// ---------------------------------------------------------------------------
// Status transition validation
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['assigned', 'in_review'],
  assigned: ['in_review', 'escalated'],
  in_review: ['action_taken', 'escalated'],
  action_taken: ['resolved'],
  resolved: ['reopened'],
  escalated: ['in_review', 'assigned'],
  reopened: ['in_review'],
};

export function isValidStatusTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns the valid next statuses for a given current status. */
export function getValidNextStatuses(from: ComplaintStatus): ComplaintStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Complaint list (admin)
// ---------------------------------------------------------------------------

export interface ComplaintListItem {
  id: string;
  trackingId: string;
  title: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  privacyMode: PrivacyMode;
  isSensitive: boolean;
  submittedAt: string;
  updatedAt: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  studentName: string | null;
  studentAlias: string | null;
  slaState: SlaState | null;
  slaHoursRemaining: number | null;
  slaDeadline: string | null;
}

export interface ComplaintListFilters {
  universityId: string;
  userId: string;
  roles: RoleName[];
  categoryKey?: string;
  departmentKey?: string;
  status?: string;
  priority?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ComplaintListResult {
  items: ComplaintListItem[];
  total: number;
}

/**
 * Role-filtered complaint list for admin dashboards.
 * Sensitive complaints are only visible when the caller holds explicit access.
 */
export async function getComplaintList(
  filters: ComplaintListFilters,
): Promise<ComplaintListResult> {
  const admin = createAdminClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // Fetch all complaints for the university (filtered later for sensitive access).
  let query = admin
    .from('complaints')
    .select(
      'id, tracking_id, student_id, title, status, priority, privacy_mode, is_sensitive, submitted_at, updated_at, department_id, assigned_to, complaint_categories ( key, label )',
      { count: 'exact' },
    )
    .eq('university_id', filters.universityId)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq('status', filters.status as ComplaintStatus);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority as ComplaintPriority);
  }

  const { data: complaints, error, count } = await query;

  if (error) {
    console.error('[complaint-mgmt] list failed:', error.message);
    return { items: [], total: 0 };
  }

  const rows = (complaints ?? []) as unknown as (Complaint & {
    complaint_categories: { key: string; label: string } | null;
  })[];

  const isAdminUser = filters.roles.includes('admin');

  // Filter sensitive complaints to those with explicit access.
  // Admin users bypass this filter and see all complaints.
  let visible = rows;
  if (!isAdminUser) {
    const sensitiveIds = rows.filter((r) => r.is_sensitive).map((r) => r.id);
    let allowedSensitive = new Set<string>();

    if (sensitiveIds.length > 0) {
      const { data: accessRows } = await admin
        .from('sensitive_case_access')
        .select('complaint_id')
        .eq('user_id', filters.userId)
        .in('complaint_id', sensitiveIds);

      allowedSensitive = new Set(
        (accessRows ?? []).map((r) => r.complaint_id),
      );
    }

    visible = rows.filter((r) => !r.is_sensitive || allowedSensitive.has(r.id));
  }

  // Non-admin staff see only their assigned complaints + unassigned (submitted) complaints.
  const scoped = isAdminUser
    ? visible
    : visible.filter(
        (r) => r.assigned_to === filters.userId || r.status === 'submitted',
      );

  // Apply search filter on title/tracking_id.
  let filtered = scoped;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = scoped.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.tracking_id.toLowerCase().includes(q),
    );
  }

  // Apply category/department filters.
  if (filters.categoryKey) {
    filtered = filtered.filter(
      (r) => r.complaint_categories?.key === filters.categoryKey,
    );
  }

  // Fetch department names and assignee names for visible complaints.
  const departmentIds = filtered.map((r) => r.department_id).filter(Boolean);
  const assigneeIds = filtered.map((r) => r.assigned_to).filter(Boolean);
  const studentIds = filtered.map((r) => r.student_id);

  const [departmentsResult, assigneeProfiles, studentProfiles, privacyRows, slaRulesResult] =
    await Promise.all([
      departmentIds.length > 0
        ? admin
            .from('departments')
            .select('id, name')
            .in('id', departmentIds as string[])
        : Promise.resolve({ data: [] }),
      assigneeIds.length > 0
        ? admin
            .from('profiles')
            .select('id, full_name')
            .in('id', assigneeIds as string[])
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? admin.from('profiles').select('id, full_name').in('id', studentIds)
        : Promise.resolve({ data: [] }),
      admin
        .from('complaint_privacy')
        .select('complaint_id, anonymous_alias, exposed_to')
        .in(
          'complaint_id',
          filtered.map((r) => r.id),
        ),
      admin
        .from('sla_rules')
        .select('id, category_key, priority, response_hours')
        .eq('university_id', filters.universityId)
        .eq('is_active', true),
    ]);

  const deptById = new Map(
    ((departmentsResult.data ?? []) as { id: string; name: string }[]).map(
      (d) => [d.id, d.name],
    ),
  );
  const nameById = new Map(
    [
      ...((assigneeProfiles.data ?? []) as { id: string; full_name: string | null }[]),
      ...((studentProfiles.data ?? []) as { id: string; full_name: string | null }[]),
    ].map((p) => [p.id, p.full_name?.trim() ?? 'Unnamed']),
  );
  const privacyByComplaint = new Map(
    (privacyRows.data ?? []).map((r) => [r.complaint_id, r]),
  );

  const slaRules = (slaRulesResult.data ?? []) as unknown as SlaRule[];
  function computeSla(
    categoryKey: string | null,
    priority: ComplaintPriority,
    submittedAt: string,
  ): { state: SlaState; hoursRemaining: number; deadline: string } | null {
    const rule =
      slaRules.find((r) => r.category_key === categoryKey && r.priority === priority) ??
      slaRules.find((r) => r.category_key === null && r.priority === priority) ??
      null;
    if (!rule) return null;
    const deadlineMs =
      new Date(submittedAt).getTime() + rule.response_hours * 60 * 60 * 1000;
    const hoursRemaining = (deadlineMs - Date.now()) / (1000 * 60 * 60);
    let state: SlaState = 'on_track';
    if (hoursRemaining <= 0) state = 'breached';
    else if (hoursRemaining <= rule.response_hours * SLA_APPROACHING_THRESHOLD) state = 'approaching';
    return {
      state,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      deadline: new Date(deadlineMs).toISOString(),
    };
  }

  const items: ComplaintListItem[] = filtered.map((r) => {
    const privacy = privacyByComplaint.get(r.id);
    const identityVisible =
      r.privacy_mode === 'identified' ||
      (r.privacy_mode === 'confidential' &&
        (privacy?.exposed_to ?? []).includes(filters.userId));

    const sla = computeSla(
      r.complaint_categories?.key ?? null,
      r.priority,
      r.submitted_at,
    );

    return {
      id: r.id,
      trackingId: r.tracking_id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      privacyMode: r.privacy_mode,
      isSensitive: r.is_sensitive,
      submittedAt: r.submitted_at,
      updatedAt: r.updated_at,
      categoryKey: r.complaint_categories?.key ?? null,
      categoryLabel: r.complaint_categories?.label ?? null,
      departmentName: r.department_id ? (deptById.get(r.department_id) ?? null) : null,
      assignedTo: r.assigned_to,
      assignedToName: r.assigned_to ? (nameById.get(r.assigned_to) ?? null) : null,
      studentName: identityVisible
        ? (nameById.get(r.student_id) ?? 'Unnamed student')
        : null,
      studentAlias: identityVisible
        ? null
        : (privacy?.anonymous_alias ??
          (r.privacy_mode === 'anonymous' ? 'Anonymous reporter' : 'Confidential reporter')),
      slaState: sla?.state ?? null,
      slaHoursRemaining: sla?.hoursRemaining ?? null,
      slaDeadline: sla?.deadline ?? null,
    };
  });

  return { items, total: filtered.length };
}

// ---------------------------------------------------------------------------
// Complaint detail (admin / tracking)
// ---------------------------------------------------------------------------

export interface ComplaintDetailResult {
  complaint: ComplaintWithCategory;
  evidence: ComplaintEvidence[];
  history: ComplaintStatusHistory[];
  privacy: Pick<ComplaintPrivacy, 'anonymous_alias' | 'exposed_to'> | null;
  aiRecommendation: AiRecommendation | null;
  assignments: ComplaintAssignment[];
  escalations: Escalation[];
  proofOfAction: ProofOfAction | null;
  resolutionEvidence: ResolutionEvidence[];
  feedback: Feedback | null;
  identityVisible: boolean;
  studentName: string | null;
  studentAlias: string | null;
  canTakeAction: boolean;
  slaDisplay: SlaDisplay | null;
  identityRequests: IdentityAccessRequest[];
}

/**
 * Full complaint detail, with role-based visibility checks.
 * Returns null when the caller cannot access this complaint.
 */
export async function getComplaintDetail(
  trackingId: string,
  userId: string,
  roles: RoleName[],
): Promise<ComplaintDetailResult | null> {
  const admin = createAdminClient();

  const { data: complaint, error } = await admin
    .from('complaints')
    .select(
      'id, tracking_id, student_id, university_id, category_id, title, description, privacy_mode, status, priority, is_sensitive, immediate_danger, submitted_at, updated_at, department_id, assigned_to, complaint_categories ( id, key, label, is_sensitive )',
    )
    .eq('tracking_id', trackingId.trim().toUpperCase())
    .maybeSingle();

  if (error || !complaint) return null;
  const typed = complaint as unknown as ComplaintWithCategory;

  // Access check: student owns it, or staff with sensitive access, or staff for non-sensitive same-uni.
  const isStudent = typed.student_id === userId;
  const isStaff = roles.some((r) =>
    ['admin', 'hod', 'proctor', 'female_focal_person', 'hostel_warden', 'counselor'].includes(r),
  );

  let canAccess = isStudent;
  if (!canAccess && isStaff) {
    if (typed.is_sensitive && !roles.includes('admin')) {
      const { data: access } = await admin
        .from('sensitive_case_access')
        .select('id')
        .eq('complaint_id', typed.id)
        .eq('user_id', userId)
        .maybeSingle();
      canAccess = Boolean(access);

      if (canAccess) {
        await audit(AUDIT_EVENTS.SENSITIVE_CASE_VIEWED, {
          userId,
          actor: 'admin',
          metadata: { tracking_id: typed.tracking_id, is_sensitive: true },
        });
      }
    } else {
      // Non-sensitive or admin: staff at the same university.
      const { data: profile } = await admin
        .from('profiles')
        .select('university_id')
        .eq('id', userId)
        .maybeSingle();
      canAccess = Boolean(profile?.university_id && profile.university_id === typed.university_id);
    }
  }

  if (!canAccess) return null;

  const [evidenceResult, historyResult, privacyResult, recommendationResult, assignmentsResult, escalationsResult, proofResult, resolutionEvidenceResult, feedbackResult] =
    await Promise.all([
      admin
        .from('complaint_evidence')
        .select('id, complaint_id, uploaded_by, storage_path, file_name, file_type, file_size_bytes, is_resolution_evidence, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: true }),
      admin
        .from('complaint_status_history')
        .select('id, complaint_id, status, changed_by, notes, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: true }),
      admin
        .from('complaint_privacy')
        .select('anonymous_alias, exposed_to')
        .eq('complaint_id', typed.id)
        .maybeSingle(),
      admin
        .from('ai_recommendations')
        .select('*')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('complaint_assignments')
        .select('id, complaint_id, assigned_to, assigned_by, department_id, notes, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: true }),
      admin
        .from('escalations')
        .select('id, complaint_id, escalated_by, escalated_to, reason, previous_status, new_status, sla_rule_id, level, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: true }),
      admin
        .from('proof_of_action')
        .select('id, complaint_id, created_by, action_taken, resolution_explanation, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('resolution_evidence')
        .select('id, complaint_id, uploaded_by, storage_path, file_name, file_type, file_size_bytes, created_at')
        .eq('complaint_id', typed.id)
        .order('created_at', { ascending: true }),
      admin
        .from('feedback')
        .select('id, complaint_id, student_id, rating, comment, created_at')
        .eq('complaint_id', typed.id)
        .maybeSingle(),
    ]);

  const privacy = (privacyResult.data as Pick<
    ComplaintPrivacy,
    'anonymous_alias' | 'exposed_to'
  > | null) ?? null;

  const identityVisible =
    isStudent ||
    typed.privacy_mode === 'identified' ||
    (typed.privacy_mode === 'confidential' &&
      (privacy?.exposed_to ?? []).includes(userId));

  // Resolve display name.
  let studentName: string | null = null;
  let studentAlias: string | null = null;
  if (identityVisible) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', typed.student_id)
      .maybeSingle();
    studentName = profile?.full_name?.trim() ?? 'Unnamed student';
  } else {
    studentAlias =
      privacy?.anonymous_alias ??
      (typed.privacy_mode === 'anonymous' ? 'Anonymous reporter' : 'Confidential reporter');
  }

  const canTakeAction = typed.assigned_to
    ? typed.assigned_to === userId
    : roles.includes('admin');

  const categoryKey = (typed.complaint_categories as { key: string } | null)?.key ?? null;
  const [slaDisplay, identityRequests] = await Promise.all([
    getSlaDisplay(
      { ...typed, category_id: typed.category_id } as Complaint,
      categoryKey,
    ),
    getIdentityRequestsForComplaint(typed.id),
  ]);

  return {
    complaint: typed,
    evidence: (evidenceResult.data ?? []) as ComplaintEvidence[],
    history: (historyResult.data ?? []) as ComplaintStatusHistory[],
    privacy,
    aiRecommendation: (recommendationResult.data as AiRecommendation | null) ?? null,
    assignments: (assignmentsResult.data ?? []) as ComplaintAssignment[],
    escalations: (escalationsResult.data ?? []) as Escalation[],
    proofOfAction: (proofResult.data as ProofOfAction | null) ?? null,
    resolutionEvidence: (resolutionEvidenceResult.data ?? []) as ResolutionEvidence[],
    feedback: (feedbackResult.data as Feedback | null) ?? null,
    identityVisible,
    studentName,
    studentAlias,
    canTakeAction,
    slaDisplay,
    identityRequests,
  };
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

export interface AssignComplaintInput {
  trackingId: string;
  assigneeId: string;
  departmentId?: string;
  notes?: string;
  actor: { userId: string; roles: RoleName[]; universityId: string };
}

export async function assignComplaint(
  input: AssignComplaintInput,
  request?: Request,
): Promise<void> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, status, is_sensitive, privacy_mode, department_id, assigned_to')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.university_id !== input.actor.universityId) {
    throw new Error('Complaint not found.');
  }

  // Sensitive case: assignee must have access (admin bypasses this check).
  if (complaint.is_sensitive && !input.actor.roles.includes('admin')) {
    const { data: access } = await admin
      .from('sensitive_case_access')
      .select('id')
      .eq('complaint_id', complaint.id)
      .eq('user_id', input.actor.userId)
      .maybeSingle();
    if (!access) {
      throw new Error('You cannot assign this protected case.');
    }
  }

  // Verify the assignee exists and is staff.
  const { data: assigneeRoles } = await admin
    .from('user_roles')
    .select('roles ( name )')
    .eq('user_id', input.assigneeId);

  const roleNames = ((assigneeRoles ?? []) as unknown as { roles: { name: RoleName } | null }[])
    .map((r) => r.roles?.name)
    .filter((n): n is RoleName => Boolean(n));

  if (roleNames.length === 0) {
    throw new Error('The selected user is not a staff member.');
  }

  // Insert assignment history row.
  await admin.from('complaint_assignments').insert({
    complaint_id: complaint.id,
    assigned_to: input.assigneeId,
    assigned_by: input.actor.userId,
    department_id: input.departmentId ?? null,
    notes: input.notes ?? null,
  });

  // Update complaint.
  const updates: Partial<Complaint> = {
    assigned_to: input.assigneeId,
  };
  if (input.departmentId) {
    updates.department_id = input.departmentId;
  }
  if (complaint.status === 'submitted') {
    updates.status = 'assigned';
  }

  await admin.from('complaints').update(updates).eq('id', complaint.id);

  // Status history for assignment.
  if (complaint.status === 'submitted') {
    await admin.from('complaint_status_history').insert({
      complaint_id: complaint.id,
      status: 'assigned',
      changed_by: input.actor.userId,
      notes: input.notes ?? 'Complaint assigned to a staff member.',
    });
  }

  // Notify the assignee.
  const { data: assigneeProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', input.assigneeId)
    .maybeSingle();

  await createNotification(
    {
      userId: input.assigneeId,
      type: 'assignment',
      complaintId: complaint.id,
      title: 'New complaint assigned',
      body: `A complaint (${complaint.tracking_id}) has been assigned to you${assigneeProfile?.full_name ? '' : ''}.`,
      trackingId: complaint.tracking_id,
    },
    request,
  );

  // Notify the student.
  await createNotification(
    {
      userId: complaint.student_id,
      type: 'case_update',
      complaintId: complaint.id,
      title: 'Your complaint has been assigned',
      body: `Your complaint ${complaint.tracking_id} has been assigned to an officer.`,
      trackingId: complaint.tracking_id,
    },
    request,
  );

  await audit(AUDIT_EVENTS.COMPLAINT_REASSIGNED, {
    userId: input.actor.userId,
    actor: 'admin',
    metadata: {
      tracking_id: complaint.tracking_id,
      assigned_to: input.assigneeId,
      department_id: input.departmentId,
      notes: input.notes,
    },
    request,
  });
}

// ---------------------------------------------------------------------------
// Status change
// ---------------------------------------------------------------------------

export interface ChangeStatusInput {
  trackingId: string;
  newStatus: ComplaintStatus;
  notes?: string;
  actor: { userId: string; roles: RoleName[]; universityId: string };
}

export async function changeComplaintStatus(
  input: ChangeStatusInput,
  request?: Request,
): Promise<void> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, status, is_sensitive, assigned_to')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.university_id !== input.actor.universityId) {
    throw new Error('Complaint not found.');
  }

  // Validate transition.
  if (!isValidStatusTransition(complaint.status, input.newStatus)) {
    throw new Error(
      `Cannot transition from "${complaint.status}" to "${input.newStatus}".`,
    );
  }

  // Update complaint status.
  await admin
    .from('complaints')
    .update({ status: input.newStatus })
    .eq('id', complaint.id);

  // Insert status history (trigger will validate transition).
  await admin.from('complaint_status_history').insert({
    complaint_id: complaint.id,
    status: input.newStatus,
    changed_by: input.actor.userId,
    notes: input.notes ?? `Status changed to ${input.newStatus}.`,
  });

  // Notifications.
  let notifType: NotificationType = 'status_change';
  if (input.newStatus === 'resolved') notifType = 'resolution';
  else if (input.newStatus === 'escalated') notifType = 'escalation';

  let notifTitle = `Complaint status updated to "${input.newStatus.replace(/_/g, ' ')}"`;
  if (input.newStatus === 'resolved') notifTitle = 'Your complaint has been resolved';
  else if (input.newStatus === 'escalated') notifTitle = 'Your complaint has been escalated';
  else if (input.newStatus === 'reopened') notifTitle = 'Your complaint has been reopened for review';

  // Notify student.
  await createNotification(
    {
      userId: complaint.student_id,
      type: notifType,
      complaintId: complaint.id,
      title: notifTitle,
      body: input.notes ?? undefined,
      trackingId: complaint.tracking_id,
    },
    request,
  );

  // Notify assigned staff (if different from actor and student).
  if (
    complaint.assigned_to &&
    complaint.assigned_to !== input.actor.userId &&
    complaint.assigned_to !== complaint.student_id
  ) {
    await createNotification(
      {
        userId: complaint.assigned_to,
        type: 'status_change',
        complaintId: complaint.id,
        title: `Complaint status updated: ${input.newStatus.replace(/_/g, ' ')}`,
        body: input.notes ?? undefined,
        trackingId: complaint.tracking_id,
      },
      request,
    );
  }

  await audit(AUDIT_EVENTS.COMPLAINT_STATUS_CHANGED, {
    userId: input.actor.userId,
    actor: 'admin',
    metadata: {
      tracking_id: complaint.tracking_id,
      from_status: complaint.status,
      to_status: input.newStatus,
      notes: input.notes,
    },
    request,
  });
}

// ---------------------------------------------------------------------------
// Dashboard summary counts
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  open: number;
  assigned: number;
  inReview: number;
  escalated: number;
  overdue: number;
}

/**
 * Counts for the admin dashboard summary cards.
 * "Overdue" = complaints not updated in 7+ days that are not resolved.
 */
export async function getDashboardSummary(
  universityId: string,
  userId: string,
  roles: RoleName[],
): Promise<DashboardSummary> {
  const admin = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: complaints } = await admin
    .from('complaints')
    .select('id, status, is_sensitive, updated_at, assigned_to')
    .eq('university_id', universityId)
    .neq('status', 'resolved');

  if (!complaints) return { open: 0, assigned: 0, inReview: 0, escalated: 0, overdue: 0 };

  const isAdminUser = roles.includes('admin');

  // Admin users see all complaints. Non-admin staff are filtered by sensitive_case_access.
  let visible = complaints;
  if (!isAdminUser) {
    const sensitiveIds = complaints.filter((c) => c.is_sensitive).map((c) => c.id);
    let allowedSensitive = new Set<string>();

    if (sensitiveIds.length > 0) {
      const { data: accessRows } = await admin
        .from('sensitive_case_access')
        .select('complaint_id')
        .eq('user_id', userId)
        .in('complaint_id', sensitiveIds);
      allowedSensitive = new Set(
        (accessRows ?? []).map((r) => r.complaint_id),
      );
    }

    visible = complaints.filter(
      (c) => !c.is_sensitive || allowedSensitive.has(c.id),
    );
  }

  // Non-admin staff see only their assigned complaints in summary counts.
  const scoped = isAdminUser
    ? visible
    : visible.filter(
        (c) => c.assigned_to === userId || c.status === 'submitted',
      );

  const open = scoped.filter((c) => c.status === 'submitted').length;
  const assigned = scoped.filter((c) => c.status === 'assigned').length;
  const inReview = scoped.filter((c) => c.status === 'in_review').length;
  const escalated = scoped.filter((c) => c.status === 'escalated').length;
  const overdue = scoped.filter(
    (c) => new Date(c.updated_at) < sevenDaysAgo,
  ).length;

  return { open, assigned, inReview, escalated, overdue };
}
