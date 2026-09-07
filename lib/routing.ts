import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { ROLES, STAFF_ROLES } from './roles';
import {
  DEFAULT_DEPARTMENT_KEY,
  DEPARTMENT_LABELS,
  SAFETY_DEPARTMENT_KEY,
} from './constants';
import { SENSITIVE_HANDLER_ROLES } from './complaints';
import type { AiAnalysisResult } from './ai';
import type {
  AiAdminOverride,
  AiRecommendation,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  Department,
  DepartmentKey,
  PrivacyMode,
  RoleName,
} from '@/types/database';

/**
 * Smart-routing helpers.
 *
 * SERVER ONLY — every function uses the service-role client, so ownership and
 * role checks are performed here explicitly rather than relying on RLS.
 *
 * Nothing in this module applies an AI recommendation on its own: recommendations
 * are persisted for review, and `applyRoutingDecision` requires an authorized
 * staff caller.
 */

/** Roles allowed to open the admin intake queue. */
export const INTAKE_ROLES: RoleName[] = [
  ROLES.ADMIN,
  ROLES.HOD,
  ROLES.PROCTOR,
  ROLES.FEMALE_FOCAL_PERSON,
  ROLES.HOSTEL_WARDEN,
  ROLES.COUNSELOR,
];

/** Departments a given staff role is a plausible assignee for. */
const ROLE_DEPARTMENT_AFFINITY: Partial<Record<RoleName, DepartmentKey[]>> = {
  hod: ['academic_affairs', 'examinations'],
  proctor: ['safety_proctor'],
  female_focal_person: ['safety_proctor'],
  counselor: ['counseling'],
  hostel_warden: ['hostel'],
  finance_officer: ['finance'],
  admin_officer: ['administration'],
};

export function departmentLabel(key: string): string {
  return DEPARTMENT_LABELS[key] ?? key;
}

/** True when any of the caller's roles may use the intake queue. */
export function canUseIntake(roles: RoleName[]): boolean {
  return roles.some((role) => INTAKE_ROLES.includes(role));
}

// ---------------------------------------------------------------------------
// Departments & routing map
// ---------------------------------------------------------------------------

export async function getDepartments(universityId: string): Promise<Department[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('departments')
    .select('id, university_id, key, name, description, is_active, created_at')
    .eq('university_id', universityId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[routing] failed to load departments:', error.message);
    return [];
  }
  return (data ?? []) as Department[];
}

export async function getDepartmentByKey(
  universityId: string,
  key: string
): Promise<Department | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('departments')
    .select('id, university_id, key, name, description, is_active, created_at')
    .eq('university_id', universityId)
    .eq('key', key as DepartmentKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[routing] failed to load department:', error.message);
    return null;
  }
  return (data as Department | null) ?? null;
}

/**
 * Resolves a department key to a real row, falling back through:
 *   AI key → routing map for the category → default department.
 */
export async function resolveDepartment(
  universityId: string,
  departmentKey: string,
  categoryKey?: string
): Promise<Department | null> {
  const direct = await getDepartmentByKey(universityId, departmentKey);
  if (direct) return direct;

  if (categoryKey) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('department_routing')
      .select('department_key')
      .eq('university_id', universityId)
      .eq('category_key', categoryKey)
      .eq('is_active', true)
      .maybeSingle();

    const mapped = data?.department_key;
    if (mapped) {
      const viaMap = await getDepartmentByKey(universityId, mapped);
      if (viaMap) return viaMap;
    }
  }

  return getDepartmentByKey(universityId, DEFAULT_DEPARTMENT_KEY);
}

export async function getCategoryByKeyForRouting(
  key: string
): Promise<ComplaintCategory | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('complaint_categories')
    .select('id, key, label, description, is_sensitive, display_order, is_active')
    .eq('key', key as ComplaintCategory['key'])
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[routing] failed to load category:', error.message);
    return null;
  }
  return (data as ComplaintCategory | null) ?? null;
}

// ---------------------------------------------------------------------------
// AI session + recommendation persistence
// ---------------------------------------------------------------------------

export async function createAiSession(input: {
  userId: string;
  sessionType: 'complaint_assist' | 'routing_review';
  /** Already sanitised / identity-stripped by the caller. */
  rawInput: string;
  privacyMode: PrivacyMode;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ai_sessions')
    .insert({
      user_id: input.userId,
      session_type: input.sessionType,
      raw_input: input.rawInput,
      privacy_mode: input.privacyMode,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[routing] failed to create ai session:', error?.message);
    return null;
  }
  return data.id;
}

export interface PersistRecommendationInput {
  sessionId: string | null;
  analysis: AiAnalysisResult;
  category: ComplaintCategory | null;
  department: Department | null;
  modelUsed: string;
  structuredDraft?: string | null;
  complaintId?: string | null;
}

export async function persistRecommendation(
  input: PersistRecommendationInput
): Promise<AiRecommendation | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('ai_recommendations')
    .insert({
      complaint_id: input.complaintId ?? null,
      session_id: input.sessionId,
      category_id: input.category?.id ?? null,
      category_key: input.analysis.category_key,
      category_confidence: input.analysis.category_confidence,
      subcategory: input.analysis.subcategory ?? null,
      priority: input.analysis.priority,
      priority_confidence: input.analysis.priority_confidence,
      department_id: input.department?.id ?? null,
      department_key: input.analysis.department_key,
      department_confidence: input.analysis.department_confidence,
      structured_draft: input.structuredDraft ?? null,
      overall_confidence: input.analysis.overall_confidence,
      model_used: input.modelUsed,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[routing] failed to persist recommendation:', error?.message);
    return null;
  }
  return data as AiRecommendation;
}

/**
 * Attaches a draft recommendation to a freshly created complaint.
 *
 * The recommendation must belong to a session owned by `userId`, otherwise the
 * link is refused — this stops a student from claiming somebody else's analysis.
 */
export async function linkRecommendationToComplaint(input: {
  recommendationId: string;
  complaintId: string;
  userId: string;
  wasEdited: boolean;
  departmentId?: string | null;
}): Promise<AiRecommendation | null> {
  const admin = createAdminClient();

  const { data: existing, error } = await admin
    .from('ai_recommendations')
    .select('id, complaint_id, session_id, department_id')
    .eq('id', input.recommendationId)
    .maybeSingle();

  if (error || !existing) {
    console.error('[routing] recommendation not found:', error?.message);
    return null;
  }
  if (existing.complaint_id) {
    console.warn('[routing] recommendation already linked; ignoring.');
    return null;
  }
  if (!existing.session_id) return null;

  const { data: session } = await admin
    .from('ai_sessions')
    .select('id, user_id')
    .eq('id', existing.session_id)
    .maybeSingle();

  if (!session || session.user_id !== input.userId) {
    console.warn('[routing] recommendation does not belong to the caller.');
    return null;
  }

  const { data: updated, error: updateError } = await admin
    .from('ai_recommendations')
    .update({
      complaint_id: input.complaintId,
      was_edited: input.wasEdited,
      department_id: input.departmentId ?? existing.department_id ?? null,
    })
    .eq('id', input.recommendationId)
    .select('*')
    .single();

  if (updateError || !updated) {
    console.error('[routing] failed to link recommendation:', updateError?.message);
    return null;
  }
  return updated as AiRecommendation;
}

export async function getRecommendationForComplaint(
  complaintId: string
): Promise<AiRecommendation | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ai_recommendations')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[routing] failed to load recommendation:', error.message);
    return null;
  }
  return (data as AiRecommendation | null) ?? null;
}

// ---------------------------------------------------------------------------
// Admin intake queue
// ---------------------------------------------------------------------------

export interface IntakeRecommendation {
  id: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  categoryConfidence: number;
  subcategory: string | null;
  priority: ComplaintPriority;
  priorityConfidence: number;
  departmentKey: string | null;
  departmentName: string | null;
  departmentId: string | null;
  departmentConfidence: number;
  overallConfidence: number;
  modelUsed: string | null;
  wasEdited: boolean;
  adminOverride: AiAdminOverride | null;
}

export interface IntakeItem {
  trackingId: string;
  title: string;
  description: string;
  status: Complaint['status'];
  priority: ComplaintPriority;
  privacyMode: PrivacyMode;
  isSensitive: boolean;
  immediateDanger: boolean;
  submittedAt: string;
  categoryId: string | null;
  categoryKey: string | null;
  categoryLabel: string | null;
  departmentId: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  /** Reporter name when the privacy mode exposes it to this staff member. */
  reporterName: string | null;
  reporterAlias: string | null;
  recommendation: IntakeRecommendation | null;
}

export interface AssignableStaff {
  userId: string;
  name: string;
  role: RoleName;
  /** Department keys this role is a natural fit for; empty means "any". */
  departmentKeys: DepartmentKey[];
}

export interface IntakeQueue {
  items: IntakeItem[];
  departments: Department[];
  staff: AssignableStaff[];
  categories: ComplaintCategory[];
}

/**
 * The review queue for one staff member.
 *
 * Visibility mirrors the Sprint 2 RLS rules exactly:
 *   - non-sensitive complaints of the caller's own university
 *   - sensitive complaints only when the caller holds an explicit
 *     `sensitive_case_access` row
 */
export async function getIntakeQueue(
  userId: string,
  universityId: string
): Promise<IntakeQueue> {
  const admin = createAdminClient();

  const [
    { data: complaints, error },
    { data: accessRows },
    departments,
    { data: categories },
  ] = await Promise.all([
    admin
      .from('complaints')
      .select(
        'id, tracking_id, student_id, university_id, category_id, title, description, privacy_mode, status, priority, is_sensitive, immediate_danger, submitted_at, updated_at, department_id, assigned_to, complaint_categories ( id, key, label, is_sensitive )'
      )
      .eq('university_id', universityId)
      .in('status', ['submitted', 'assigned'])
      .order('submitted_at', { ascending: false })
      .limit(200),
    admin.from('sensitive_case_access').select('complaint_id').eq('user_id', userId),
    getDepartments(universityId),
    admin
      .from('complaint_categories')
      .select('id, key, label, description, is_sensitive, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  if (error) {
    console.error('[routing] failed to load intake queue:', error.message);
    return { items: [], departments, staff: [], categories: [] };
  }

  const allowedSensitive = new Set(
    (accessRows ?? []).map((row) => row.complaint_id)
  );

  type Row = Complaint & {
    complaint_categories: Pick<
      ComplaintCategory,
      'id' | 'key' | 'label' | 'is_sensitive'
    > | null;
  };

  const visible = ((complaints ?? []) as unknown as Row[]).filter((row) =>
    row.is_sensitive ? allowedSensitive.has(row.id) : true
  );

  if (visible.length === 0) {
    return { items: [], departments, staff: await getAssignableStaff(universityId), categories: (categories ?? []) as ComplaintCategory[] };
  }

  const ids = visible.map((row) => row.id);

  const [{ data: recommendations }, { data: privacyRows }, staff] = await Promise.all([
    admin.from('ai_recommendations').select('*').in('complaint_id', ids),
    admin
      .from('complaint_privacy')
      .select('complaint_id, anonymous_alias, exposed_to')
      .in('complaint_id', ids),
    getAssignableStaff(universityId),
  ]);

  const departmentById = new Map(departments.map((d) => [d.id, d]));
  const staffById = new Map(staff.map((s) => [s.userId, s]));

  const recommendationByComplaint = new Map<string, AiRecommendation>();
  for (const row of (recommendations ?? []) as AiRecommendation[]) {
    if (!row.complaint_id) continue;
    const current = recommendationByComplaint.get(row.complaint_id);
    if (!current || current.created_at < row.created_at) {
      recommendationByComplaint.set(row.complaint_id, row);
    }
  }

  const privacyByComplaint = new Map(
    (privacyRows ?? []).map((row) => [row.complaint_id, row])
  );

  // Reporter names are only fetched for complaints whose privacy mode allows it.
  const identifiableStudentIds = visible
    .filter((row) => {
      const privacy = privacyByComplaint.get(row.id);
      if (row.privacy_mode === 'identified') return true;
      if (row.privacy_mode === 'confidential') {
        return (privacy?.exposed_to ?? []).includes(userId);
      }
      return false;
    })
    .map((row) => row.student_id);

  const nameById = new Map<string, string>();
  const nameLookupIds = Array.from(
    new Set([...identifiableStudentIds, ...staff.map((s) => s.userId)])
  );

  if (nameLookupIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', nameLookupIds);

    for (const profile of profiles ?? []) {
      nameById.set(profile.id, profile.full_name?.trim() || 'Unnamed user');
    }
  }

  const categoryList = (categories ?? []) as ComplaintCategory[];

  const items: IntakeItem[] = visible.map((row) => {
    const privacy = privacyByComplaint.get(row.id);
    const identityVisible =
      row.privacy_mode === 'identified' ||
      (row.privacy_mode === 'confidential' &&
        (privacy?.exposed_to ?? []).includes(userId));

    const recommendation = recommendationByComplaint.get(row.id) ?? null;
    const recommendedDepartment = recommendation?.department_id
      ? departmentById.get(recommendation.department_id)
      : undefined;
    const currentDepartment = row.department_id
      ? departmentById.get(row.department_id)
      : undefined;

    const recommendedCategory = recommendation?.category_key
      ? categoryList.find((c) => c.key === recommendation.category_key)
      : undefined;

    return {
      trackingId: row.tracking_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      privacyMode: row.privacy_mode,
      isSensitive: row.is_sensitive,
      immediateDanger: row.immediate_danger,
      submittedAt: row.submitted_at,
      categoryId: row.category_id,
      categoryKey: row.complaint_categories?.key ?? null,
      categoryLabel: row.complaint_categories?.label ?? null,
      departmentId: row.department_id,
      departmentName: currentDepartment?.name ?? null,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to
        ? (staffById.get(row.assigned_to)?.name ??
          nameById.get(row.assigned_to) ??
          null)
        : null,
      reporterName: identityVisible
        ? (nameById.get(row.student_id) ?? 'Unnamed student')
        : null,
      reporterAlias: identityVisible
        ? null
        : (privacy?.anonymous_alias ??
          (row.privacy_mode === 'anonymous'
            ? 'Anonymous reporter'
            : 'Confidential reporter')),
      recommendation: recommendation
        ? {
            id: recommendation.id,
            categoryKey: recommendation.category_key,
            categoryLabel: recommendedCategory?.label ?? recommendation.category_key,
            categoryConfidence: Number(recommendation.category_confidence),
            subcategory: recommendation.subcategory,
            priority: recommendation.priority,
            priorityConfidence: Number(recommendation.priority_confidence),
            departmentKey: recommendation.department_key,
            departmentName:
              recommendedDepartment?.name ??
              (recommendation.department_key
                ? departmentLabel(recommendation.department_key)
                : null),
            departmentId: recommendation.department_id,
            departmentConfidence: Number(recommendation.department_confidence),
            overallConfidence: Number(recommendation.overall_confidence),
            modelUsed: recommendation.model_used,
            wasEdited: recommendation.was_edited,
            adminOverride: recommendation.admin_override,
          }
        : null,
    };
  });

  return { items, departments, staff, categories: categoryList };
}

/** Staff members of one university who can own a case. */
export async function getAssignableStaff(
  universityId: string
): Promise<AssignableStaff[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_roles')
    .select('user_id, university_id, roles ( name )')
    .eq('university_id', universityId);

  if (error) {
    console.error('[routing] failed to load staff:', error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    user_id: string;
    roles: { name: RoleName } | null;
  }[];

  const staffRows = rows.filter((row) => {
    const name = row.roles?.name;
    return Boolean(name) && STAFF_ROLES.includes(name!);
  });

  if (staffRows.length === 0) return [];

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, affiliation_status')
    .in(
      'id',
      staffRows.map((row) => row.user_id)
    );

  const verifiedProfiles = (profiles ?? []).filter(
    (p) => p.affiliation_status === 'verified'
  );
  const nameById = new Map(
    verifiedProfiles.map((p) => [p.id, p.full_name?.trim() || 'Unnamed staff'])
  );

  return staffRows
    .filter((row) => nameById.has(row.user_id))
    .map((row) => {
      const role = row.roles!.name;
      return {
        userId: row.user_id,
        name: nameById.get(row.user_id) ?? 'Unnamed staff',
        role,
        departmentKeys: ROLE_DEPARTMENT_AFFINITY[role] ?? [],
      };
    });
}

/**
 * Maps a complaint category key to the staff roles best suited to handle it.
 *
 * Used by the admin assignment dropdown to show only relevant authorities.
 */
const CATEGORY_RELEVANT_ROLES: Partial<Record<string, RoleName[]>> = {
  academic: ['hod'],
  facilities: ['hod'],
  hostel: ['hostel_warden'],
  financial: ['finance_officer'],
  administration: ['admin_officer'],
  safety_harassment: ['female_focal_person', 'proctor', 'counselor'],
  mental_health: ['counselor'],
  other: ['hod'],
};

/**
 * Filters assignable staff to only those relevant for a given complaint category.
 *
 * If no mapping exists for the category, all staff are returned as a safe fallback.
 * If the category mapping exists but no staff match, falls back to hod to ensure
 * there's always at least one authority available.
 */
export function filterStaffByCategory(
  staff: AssignableStaff[],
  categoryKey: string,
): AssignableStaff[] {
  const relevantRoles = CATEGORY_RELEVANT_ROLES[categoryKey];
  if (!relevantRoles) return staff;
  const filtered = staff.filter((s) => relevantRoles.includes(s.role));
  // Fallback to hod if no staff match the category-specific roles
  if (filtered.length === 0) {
    const hodStaff = staff.filter((s) => s.role === 'hod');
    // If hod also has no staff, fall back to ALL staff to ensure there's always at least one authority
    if (hodStaff.length === 0) {
      return staff;
    }
    return hodStaff;
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Applying a routing decision (human review gate)
// ---------------------------------------------------------------------------

export interface RoutingDecisionInput {
  trackingId: string;
  categoryId?: string | null;
  priority?: ComplaintPriority | null;
  departmentId?: string | null;
  assigneeId?: string | null;
  reason?: string | null;
}

export interface RoutingDecisionResult {
  trackingId: string;
  status: Complaint['status'];
  categoryId: string | null;
  priority: ComplaintPriority;
  departmentId: string | null;
  assignedTo: string | null;
  overrodeRecommendation: boolean;
}

/**
 * Applies an admin's routing decision to a complaint.
 *
 * Enforced here (the service role bypasses RLS):
 *   - the caller must hold an intake role at the complaint's university
 *   - sensitive complaints require an explicit `sensitive_case_access` row
 *   - an assignee routed onto a sensitive case is granted access first, so the
 *     case never lands with somebody who cannot open it
 */
export async function applyRoutingDecision(
  input: RoutingDecisionInput,
  actor: { userId: string; roles: RoleName[]; universityId: string | null },
  request?: Request
): Promise<RoutingDecisionResult> {
  if (!canUseIntake(actor.roles)) {
    throw new Error('You are not authorized to route complaints.');
  }

  const admin = createAdminClient();

  const { data: complaint, error } = await admin
    .from('complaints')
    .select(
      'id, tracking_id, university_id, category_id, priority, status, is_sensitive, department_id, assigned_to, privacy_mode'
    )
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (error) throw new Error('Could not load the complaint.');
  if (!complaint) throw new Error('Complaint not found.');

  if (
    !complaint.university_id ||
    complaint.university_id !== actor.universityId
  ) {
    throw new Error('Complaint not found.');
  }

  if (complaint.is_sensitive) {
    const { data: access } = await admin
      .from('sensitive_case_access')
      .select('id')
      .eq('complaint_id', complaint.id)
      .eq('user_id', actor.userId)
      .maybeSingle();

    if (!access) {
      throw new Error('This case is restricted to its assigned safety handler.');
    }
  }

  // --- Validate the requested values --------------------------------------
  let category: ComplaintCategory | null = null;
  if (input.categoryId && input.categoryId !== complaint.category_id) {
    const { data } = await admin
      .from('complaint_categories')
      .select('id, key, label, description, is_sensitive, display_order, is_active')
      .eq('id', input.categoryId)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) throw new Error('The selected category is not available.');
    category = data as ComplaintCategory;

    // Sprint 3 intake never converts a case into (or out of) the protected
    // sensitive workflow — that transition needs its own review path.
    if (Boolean(category.is_sensitive) !== Boolean(complaint.is_sensitive)) {
      throw new Error(
        'You cannot move a case between the sensitive and standard workflows here.'
      );
    }
  }

  let department: Department | null = null;
  if (input.departmentId) {
    const { data } = await admin
      .from('departments')
      .select('id, university_id, key, name, description, is_active, created_at')
      .eq('id', input.departmentId)
      .eq('university_id', complaint.university_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) throw new Error('The selected department is not available.');
    department = data as Department;
  }

  if (complaint.is_sensitive && department && department.key !== SAFETY_DEPARTMENT_KEY) {
    throw new Error(
      'Safety cases must stay with the Proctorial & Safety Office.'
    );
  }

  let assignee: AssignableStaff | null = null;
  if (input.assigneeId) {
    const staff = await getAssignableStaff(complaint.university_id);
    assignee = staff.find((s) => s.userId === input.assigneeId) ?? null;
    if (!assignee) {
      throw new Error('The selected staff member cannot be assigned at this university.');
    }
    if (
      complaint.is_sensitive &&
      !SENSITIVE_HANDLER_ROLES.includes(assignee.role)
    ) {
      throw new Error(
        'Safety cases can only be assigned to a Female Focal Person, Proctor, Counselor or Administrator.'
      );
    }
  }

  const priority = input.priority ?? complaint.priority;

  // --- Record the override on the recommendation ---------------------------
  const recommendation = await getRecommendationForComplaint(complaint.id);

  const finalCategoryId = category?.id ?? complaint.category_id;
  const finalDepartmentId = department?.id ?? complaint.department_id;

  const overrodeRecommendation = Boolean(
    recommendation &&
      ((recommendation.category_id &&
        finalCategoryId &&
        recommendation.category_id !== finalCategoryId) ||
        recommendation.priority !== priority ||
        (recommendation.department_id &&
          finalDepartmentId &&
          recommendation.department_id !== finalDepartmentId))
  );

  if (recommendation && (overrodeRecommendation || input.reason)) {
    const override: AiAdminOverride = {
      category_id: finalCategoryId,
      priority,
      department_id: finalDepartmentId,
      reason: input.reason?.trim() || null,
      overridden_by: actor.userId,
      overridden_at: new Date().toISOString(),
    };

    const { error: overrideError } = await admin
      .from('ai_recommendations')
      .update({ admin_override: override })
      .eq('id', recommendation.id);

    if (overrideError) {
      console.error('[routing] failed to store override:', overrideError.message);
    } else {
      await audit(AUDIT_EVENTS.AI_RECOMMENDATION_OVERRIDDEN, {
        userId: actor.userId,
        actor: 'admin',
        metadata: {
          tracking_id: complaint.tracking_id,
          recommendation_id: recommendation.id,
          from: {
            category_id: recommendation.category_id,
            priority: recommendation.priority,
            department_id: recommendation.department_id,
          },
          to: {
            category_id: finalCategoryId,
            priority,
            department_id: finalDepartmentId,
          },
          reason: override.reason,
        },
        request,
      });
    }
  }

  // --- Grant sensitive access BEFORE assigning -----------------------------
  if (complaint.is_sensitive && assignee) {
    const { error: accessError } = await admin
      .from('sensitive_case_access')
      .upsert(
        {
          complaint_id: complaint.id,
          user_id: assignee.userId,
          role: assignee.role,
        },
        { onConflict: 'complaint_id,user_id' }
      );

    if (accessError) {
      console.error('[routing] failed to grant sensitive access:', accessError.message);
      throw new Error('Could not grant the assignee access to this protected case.');
    }

    // Confidential reporters stay hidden from everyone but the named handler,
    // so the new handler is added to the exposure list.
    if (complaint.privacy_mode === 'confidential') {
      const { data: privacy } = await admin
        .from('complaint_privacy')
        .select('exposed_to')
        .eq('complaint_id', complaint.id)
        .maybeSingle();

      const exposed = new Set(privacy?.exposed_to ?? []);
      exposed.add(assignee.userId);

      await admin
        .from('complaint_privacy')
        .update({ exposed_to: Array.from(exposed) })
        .eq('complaint_id', complaint.id);
    }
  }

  // --- Update the complaint ----------------------------------------------
  const nextStatus: Complaint['status'] = assignee
    ? 'assigned'
    : complaint.status === 'submitted'
      ? 'submitted'
      : complaint.status;

  const { error: updateError } = await admin
    .from('complaints')
    .update({
      category_id: finalCategoryId,
      priority,
      department_id: finalDepartmentId,
      assigned_to: assignee?.userId ?? complaint.assigned_to,
      status: nextStatus,
    })
    .eq('id', complaint.id);

  if (updateError) {
    console.error('[routing] failed to update complaint:', updateError.message);
    throw new Error('Could not apply the routing decision.');
  }

  // --- Timeline entry ----------------------------------------------------
  if (assignee) {
    const noteParts = [
      `Routed to ${department?.name ?? 'the assigned department'}`,
      `assigned to ${assignee.name}`,
    ];
    if (input.reason?.trim()) noteParts.push(`Reason: ${input.reason.trim()}`);

    const { error: historyError } = await admin
      .from('complaint_status_history')
      .insert({
        complaint_id: complaint.id,
        status: 'assigned',
        changed_by: actor.userId,
        notes: `${noteParts.join(' — ')}.`,
      });

    if (historyError) {
      console.error('[routing] failed to write history:', historyError.message);
    }

    await audit(AUDIT_EVENTS.COMPLAINT_ASSIGNED, {
      userId: actor.userId,
      actor: 'admin',
      metadata: {
        tracking_id: complaint.tracking_id,
        assignee_id: assignee.userId,
        assignee_role: assignee.role,
        department_id: finalDepartmentId,
        priority,
        is_sensitive: complaint.is_sensitive,
        ai_recommended: Boolean(recommendation),
        overrode_recommendation: overrodeRecommendation,
      },
      request,
    });
  }

  return {
    trackingId: complaint.tracking_id,
    status: nextStatus,
    categoryId: finalCategoryId,
    priority,
    departmentId: finalDepartmentId,
    assignedTo: assignee?.userId ?? complaint.assigned_to,
    overrodeRecommendation,
  };
}
