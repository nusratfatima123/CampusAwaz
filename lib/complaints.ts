import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { generateTrackingId } from './tracking';
import { extensionForMime, validateEvidenceFile } from './validators';
import {
  DEFAULT_DEPARTMENT_KEY,
  EVIDENCE_BUCKET,
  EVIDENCE_SIGNED_URL_TTL_SECONDS,
  MAX_EVIDENCE_FILES,
} from './constants';
import { ROLES } from './roles';
import type {
  AiRecommendation,
  Complaint,
  ComplaintCategory,
  ComplaintCategoryKey,
  ComplaintEvidence,
  ComplaintPriority,
  ComplaintPrivacy,
  ComplaintStatusHistory,
  ComplaintWithCategory,
  PrivacyMode,
  RoleName,
} from '@/types/database';

/**
 * Server-side complaint helpers.
 *
 * SERVER ONLY. Every function here uses the service-role client, so it must
 * never be imported from a Client Component. Each entry point takes the caller's
 * user id explicitly and enforces ownership itself — the service role bypasses
 * RLS, so these checks are the authoritative guard for API routes.
 */

/** Roles allowed to handle sensitive (harassment / safety) cases, in priority order. */
export const SENSITIVE_HANDLER_ROLES: RoleName[] = [
  ROLES.FEMALE_FOCAL_PERSON,
  ROLES.PROCTOR,
  ROLES.ADMIN,
  ROLES.COUNSELOR,
];

export const PRIVACY_MODE_LABELS: Record<PrivacyMode, string> = {
  identified: 'Identified',
  confidential: 'Confidential',
  anonymous: 'Anonymous',
};

export interface CreateComplaintInput {
  categoryId: string;
  title: string;
  description: string;
  privacyMode: PrivacyMode;
  immediateDanger?: boolean;
  /** Storage paths returned by `uploadEvidence`. */
  evidencePaths?: string[];
  /**
   * Sprint 3 — draft recommendation the student reviewed. Linked to the created
   * complaint only when the recommendation belongs to one of their own sessions.
   */
  aiRecommendationId?: string | null;
  /** True when the student changed any AI-suggested value before submitting. */
  aiWasEdited?: boolean;
  /**
   * Priority the student approved. Only honoured when it does not weaken the
   * baseline the sensitivity rules already require.
   */
  aiPriority?: ComplaintPriority | null;
}

export interface CreateComplaintResult {
  id: string;
  trackingId: string;
  isSensitive: boolean;
  status: Complaint['status'];
  /** Sprint 3 — set when an AI recommendation was successfully linked. */
  aiRecommendationId: string | null;
  aiRecommended: boolean;
}

/** Short, stable-looking alias shown to handlers instead of a real identity. */
export function generateAnonymousAlias(): string {
  const short = crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `Student-${short}`;
}

/** Loads the active category list for the picker. */
export async function getActiveCategories(): Promise<ComplaintCategory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('complaint_categories')
    .select('id, key, label, description, is_sensitive, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[complaints] failed to load categories:', error.message);
    return [];
  }
  return (data ?? []) as ComplaintCategory[];
}

export async function getCategoryByKey(
  key: string
): Promise<ComplaintCategory | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('complaint_categories')
    .select('id, key, label, description, is_sensitive, display_order, is_active')
    .eq('key', key as ComplaintCategoryKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[complaints] failed to load category:', error.message);
    return null;
  }
  return (data as ComplaintCategory | null) ?? null;
}

/**
 * Uploads one evidence file to the private bucket under `{userId}/…` and
 * returns its storage path. Re-validates type/size server-side.
 */
export async function uploadEvidence(
  file: File,
  userId: string,
  complaintId?: string
): Promise<{ path: string; name: string; type: string; size: number }> {
  const check = validateEvidenceFile({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (!check.valid) {
    throw new Error(check.error ?? 'This file cannot be used as evidence.');
  }

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = complaintId ? `${userId}/${complaintId}` : `${userId}/staged`;
  const path = `${folder}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;

  const { error } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[complaints] evidence upload failed:', error.message);
    throw new Error(
      `Could not store "${file.name}". Confirm the "${EVIDENCE_BUCKET}" bucket exists, then try again.`
    );
  }

  return { path, name: file.name, type: file.type, size: file.size };
}

/** Removes staged objects after a failed create so nothing is orphaned. */
async function cleanupObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.storage.from(EVIDENCE_BUCKET).remove(paths);
  } catch (err) {
    console.error(
      '[complaints] evidence cleanup failed:',
      err instanceof Error ? err.message : err
    );
  }
}

interface EvidenceDescriptor {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Creates a complaint end-to-end:
 *   1. validate category (must exist + be active)
 *   2. allocate an atomic tracking id
 *   3. insert the complaint row
 *   4. insert the initial status-history row
 *   5. insert the privacy row (alias for anonymous, exposure list otherwise)
 *   6. link uploaded evidence rows
 *   7. assign sensitive-case handlers when the category is sensitive
 *   8. write audit events
 *
 * Postgres has no cross-statement transaction over the REST API, so failures
 * roll back by deleting the complaint row (cascades to children) and removing
 * uploaded objects.
 */
export async function createComplaint(
  data: CreateComplaintInput & { evidence?: EvidenceDescriptor[] },
  userId: string,
  request?: Request
): Promise<CreateComplaintResult> {
  const admin = createAdminClient();

  // --- Caller must be a verified student of a known university --------------
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, university_id, affiliation_status')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw new Error('Could not load your profile. Please try again.');
  }
  if (!profile) {
    throw new Error('Profile not found.');
  }
  if (profile.affiliation_status !== 'verified') {
    throw new Error('Only verified students can submit complaints.');
  }
  if (!profile.university_id) {
    throw new Error('Select your university before submitting a complaint.');
  }

  // --- Category must be real, active and untampered ------------------------
  const { data: category, error: categoryError } = await admin
    .from('complaint_categories')
    .select('id, key, label, is_sensitive, is_active')
    .eq('id', data.categoryId)
    .maybeSingle();

  if (categoryError) {
    throw new Error('Could not validate the selected category.');
  }
  if (!category || !category.is_active) {
    throw new Error('The selected category is not available.');
  }

  const isSensitive = Boolean(category.is_sensitive);
  const immediateDanger = isSensitive ? Boolean(data.immediateDanger) : false;
  const evidence = data.evidence ?? [];

  if (evidence.length > MAX_EVIDENCE_FILES) {
    throw new Error(`You can attach at most ${MAX_EVIDENCE_FILES} files.`);
  }

  const trackingId = await generateTrackingId(profile.university_id);

  // --- Priority ------------------------------------------------------------
  // Sensitivity sets the floor; the priority the student approved from the AI
  // recommendation may raise it but never lower it.
  const baselinePriority: ComplaintPriority = immediateDanger
    ? 'critical'
    : isSensitive
      ? 'high'
      : 'medium';

  const priority = strongestPriority(baselinePriority, data.aiPriority ?? null);

  // --- Department ----------------------------------------------------------
  // Sprint 3 records the owning department at intake from the routing map; an
  // admin can still override it in the intake queue.
  const departmentId = await resolveDepartmentForCategory(
    profile.university_id,
    category.key
  );

  // --- Complaint row -------------------------------------------------------
  const { data: complaint, error: insertError } = await admin
    .from('complaints')
    .insert({
      tracking_id: trackingId,
      student_id: userId,
      university_id: profile.university_id,
      category_id: category.id,
      title: data.title.trim(),
      description: data.description.trim(),
      privacy_mode: data.privacyMode,
      status: 'submitted',
      priority,
      is_sensitive: isSensitive,
      immediate_danger: immediateDanger,
      department_id: departmentId,
    })
    .select('id, tracking_id, status')
    .single();

  if (insertError || !complaint) {
    await cleanupObjects(evidence.map((e) => e.path));
    console.error('[complaints] insert failed:', insertError?.message);
    throw new Error('Could not save your complaint. Please try again.');
  }

  const rollback = async (message: string): Promise<never> => {
    await admin.from('complaints').delete().eq('id', complaint.id);
    await cleanupObjects(evidence.map((e) => e.path));
    throw new Error(message);
  };

  // --- Status history ------------------------------------------------------
  const { error: historyError } = await admin
    .from('complaint_status_history')
    .insert({
      complaint_id: complaint.id,
      status: 'submitted',
      changed_by: userId,
      notes: 'Complaint submitted by the student.',
    });

  if (historyError) {
    console.error('[complaints] status history failed:', historyError.message);
    await rollback('Could not record the complaint timeline. Please try again.');
  }

  // --- Privacy row ---------------------------------------------------------
  const alias =
    data.privacyMode === 'anonymous' ? generateAnonymousAlias() : null;

  const { error: privacyError } = await admin.from('complaint_privacy').insert({
    complaint_id: complaint.id,
    student_id: userId,
    // Populated with the assigned handler ids below for confidential cases.
    exposed_to: [],
    anonymous_alias: alias,
  });

  if (privacyError) {
    console.error('[complaints] privacy row failed:', privacyError.message);
    await rollback('Could not apply your privacy choice. Please try again.');
  }

  // --- Evidence rows -------------------------------------------------------
  if (evidence.length > 0) {
    const { error: evidenceError } = await admin
      .from('complaint_evidence')
      .insert(
        evidence.map((file) => ({
          complaint_id: complaint.id,
          uploaded_by: userId,
          storage_path: file.path,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
        }))
      );

    if (evidenceError) {
      console.error('[complaints] evidence rows failed:', evidenceError.message);
      await rollback('Could not attach your evidence. Please try again.');
    }

    await audit(AUDIT_EVENTS.COMPLAINT_EVIDENCE_UPLOADED, {
      userId,
      actor: 'user',
      metadata: {
        tracking_id: trackingId,
        file_count: evidence.length,
        total_bytes: evidence.reduce((sum, f) => sum + f.size, 0),
        mime_types: evidence.map((f) => f.type),
      },
      request,
    });
  }

  // --- Sensitive-case assignment ------------------------------------------
  let assignedHandlers: { user_id: string; role: RoleName }[] = [];

  if (isSensitive) {
    assignedHandlers = await resolveSensitiveHandlers(profile.university_id);

    if (assignedHandlers.length > 0) {
      const { error: accessError } = await admin
        .from('sensitive_case_access')
        .insert(
          assignedHandlers.map((handler) => ({
            complaint_id: complaint.id,
            user_id: handler.user_id,
            role: handler.role,
          }))
        );

      if (accessError) {
        console.error('[complaints] sensitive access failed:', accessError.message);
        await rollback(
          'Could not route your safety report securely. Please try again.'
        );
      }

      await admin
        .from('complaints')
        .update({ status: 'assigned' })
        .eq('id', complaint.id);

      await admin.from('complaint_status_history').insert({
        complaint_id: complaint.id,
        status: 'assigned',
        changed_by: null,
        notes: 'Routed to the protected safety desk.',
      });
    } else {
      console.warn(
        `[complaints] no sensitive handler configured for university ${profile.university_id}; case ${trackingId} left unassigned.`
      );
    }

    await audit(AUDIT_EVENTS.COMPLAINT_SENSITIVE_CREATED, {
      userId,
      actor: 'user',
      metadata: {
        tracking_id: trackingId,
        immediate_danger: immediateDanger,
        assigned_roles: assignedHandlers.map((h) => h.role),
        assigned_count: assignedHandlers.length,
      },
      request,
    });
  }

  // --- Confidential mode: expose identity to the assigned handlers only ----
  if (data.privacyMode === 'confidential' && assignedHandlers.length > 0) {
    await admin
      .from('complaint_privacy')
      .update({ exposed_to: assignedHandlers.map((h) => h.user_id) })
      .eq('complaint_id', complaint.id);
  }

  // --- Sprint 3: link the reviewed AI recommendation ----------------------
  // A failure here is non-fatal — the complaint itself is already safe, and the
  // student must never lose a filed report because the AI trail could not be
  // written.
  let linkedRecommendationId: string | null = null;

  if (data.aiRecommendationId) {
    const { linkRecommendationToComplaint } = await import('./routing');

    const linked = await linkRecommendationToComplaint({
      recommendationId: data.aiRecommendationId,
      complaintId: complaint.id,
      userId,
      wasEdited: Boolean(data.aiWasEdited),
      departmentId,
    });

    linkedRecommendationId = linked?.id ?? null;

    if (linked) {
      await audit(AUDIT_EVENTS.AI_RECOMMENDATION_LINKED, {
        userId,
        actor: 'user',
        metadata: {
          tracking_id: trackingId,
          recommendation_id: linked.id,
          was_edited: linked.was_edited,
          recommended_category_key: linked.category_key,
          submitted_category_key: category.key,
          recommended_priority: linked.priority,
          submitted_priority: priority,
          overall_confidence: Number(linked.overall_confidence),
          model_used: linked.model_used,
        },
        request,
      });
    }
  }

  // --- Audit --------------------------------------------------------------
  await audit(AUDIT_EVENTS.COMPLAINT_SUBMITTED, {
    userId,
    actor: 'user',
    metadata: {
      tracking_id: trackingId,
      category_key: category.key,
      is_sensitive: isSensitive,
      privacy_mode: data.privacyMode,
      evidence_count: evidence.length,
      priority,
      department_id: departmentId,
      ai_recommended: Boolean(linkedRecommendationId),
      ai_recommendation_id: linkedRecommendationId,
      ai_was_edited: Boolean(linkedRecommendationId && data.aiWasEdited),
    },
    request,
  });

  await audit(AUDIT_EVENTS.COMPLAINT_PRIVACY_CHANGED, {
    userId,
    actor: 'user',
    metadata: {
      tracking_id: trackingId,
      privacy_mode: data.privacyMode,
      anonymous_alias: alias,
      exposed_to_count:
        data.privacyMode === 'confidential' ? assignedHandlers.length : 0,
    },
    request,
  });

  const finalStatus: Complaint['status'] =
    isSensitive && assignedHandlers.length > 0 ? 'assigned' : 'submitted';

  return {
    id: complaint.id,
    trackingId,
    isSensitive,
    status: finalStatus,
    aiRecommendationId: linkedRecommendationId,
    aiRecommended: Boolean(linkedRecommendationId),
  };
}

/** Priority ordering used to stop an AI suggestion weakening the baseline. */
const PRIORITY_RANK: Record<ComplaintPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Returns whichever priority is more urgent. */
export function strongestPriority(
  baseline: ComplaintPriority,
  candidate: ComplaintPriority | null
): ComplaintPriority {
  if (!candidate || !(candidate in PRIORITY_RANK)) return baseline;
  return PRIORITY_RANK[candidate] > PRIORITY_RANK[baseline] ? candidate : baseline;
}

/**
 * Looks up the department that owns a category at one university, using the
 * Sprint 3 routing map. Returns null when the migration has not been applied.
 */
async function resolveDepartmentForCategory(
  universityId: string,
  categoryKey: string
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: routing, error } = await admin
    .from('department_routing')
    .select('department_key')
    .eq('university_id', universityId)
    .eq('category_key', categoryKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    // 003_ai_routing.sql not applied yet — intake still works without a owner.
    console.warn('[complaints] routing lookup skipped:', error.message);
    return null;
  }

  const departmentKey = routing?.department_key ?? DEFAULT_DEPARTMENT_KEY;

  const { data: department } = await admin
    .from('departments')
    .select('id')
    .eq('university_id', universityId)
    .eq('key', departmentKey)
    .eq('is_active', true)
    .maybeSingle();

  return department?.id ?? null;
}

/**
 * Picks the handlers for a sensitive case at a university:
 * the first available Female Focal Person, else a Proctor, Admin or Counselor.
 */
export async function resolveSensitiveHandlers(
  universityId: string
): Promise<{ user_id: string; role: RoleName }[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_roles')
    .select('user_id, university_id, roles ( name )')
    .eq('university_id', universityId);

  if (error) {
    console.error('[complaints] failed to resolve handlers:', error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    user_id: string;
    roles: { name: RoleName } | null;
  }[];

  for (const role of SENSITIVE_HANDLER_ROLES) {
    const match = rows.find((row) => row.roles?.name === role);
    if (match) return [{ user_id: match.user_id, role }];
  }

  return [];
}

/** All complaints belonging to one student, newest first. */
export async function getStudentComplaints(
  userId: string
): Promise<ComplaintWithCategory[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('complaints')
    .select(
      'id, tracking_id, student_id, university_id, category_id, title, description, privacy_mode, status, priority, is_sensitive, immediate_danger, submitted_at, updated_at, department_id, assigned_to, complaint_categories ( id, key, label, is_sensitive )'
    )
    .eq('student_id', userId)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('[complaints] failed to list complaints:', error.message);
    return [];
  }

  return (data ?? []) as unknown as ComplaintWithCategory[];
}

export interface ComplaintDetail {
  complaint: ComplaintWithCategory;
  evidence: ComplaintEvidence[];
  history: ComplaintStatusHistory[];
  privacy: Pick<ComplaintPrivacy, 'anonymous_alias' | 'exposed_to'> | null;
  /** Sprint 3 — the AI recommendation the student reviewed, when there was one. */
  aiRecommendation: AiRecommendation | null;
}

/**
 * Full complaint detail, scoped to the owning student.
 *
 * Sprint 2 exposes detail views to the reporter only; staff surfaces arrive with
 * the admin dashboards, so this deliberately returns null for anybody else.
 */
export async function getComplaintByTrackingId(
  trackingId: string,
  userId: string
): Promise<ComplaintDetail | null> {
  const admin = createAdminClient();

  const { data: complaint, error } = await admin
    .from('complaints')
    .select(
      'id, tracking_id, student_id, university_id, category_id, title, description, privacy_mode, status, priority, is_sensitive, immediate_danger, submitted_at, updated_at, department_id, assigned_to, complaint_categories ( id, key, label, is_sensitive )'
    )
    .eq('tracking_id', trackingId.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('[complaints] failed to load complaint:', error.message);
    return null;
  }
  // Ownership check — the service role bypasses RLS, so this is the real guard.
  if (!complaint || complaint.student_id !== userId) return null;

  const typed = complaint as unknown as ComplaintWithCategory;

  const [evidenceResult, historyResult, privacyResult, recommendationResult] =
    await Promise.all([
      admin
        .from('complaint_evidence')
        .select(
          'id, complaint_id, uploaded_by, storage_path, file_name, file_type, file_size_bytes, is_resolution_evidence, created_at'
        )
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
    ]);

  return {
    complaint: typed,
    evidence: (evidenceResult.data ?? []) as ComplaintEvidence[],
    history: (historyResult.data ?? []) as ComplaintStatusHistory[],
    privacy:
      (privacyResult.data as Pick<
        ComplaintPrivacy,
        'anonymous_alias' | 'exposed_to'
      > | null) ?? null,
    aiRecommendation: (recommendationResult.data as AiRecommendation | null) ?? null,
  };
}

export interface SignedEvidence {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  createdAt: string;
  url: string | null;
}

/** Signed URLs (1 hour) for the evidence of a complaint the caller owns. */
export async function getEvidenceSignedUrls(
  trackingId: string,
  userId: string
): Promise<SignedEvidence[] | null> {
  const detail = await getComplaintByTrackingId(trackingId, userId);
  if (!detail) return null;

  const admin = createAdminClient();

  return Promise.all(
    detail.evidence.map(async (item) => {
      const { data, error } = await admin.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(item.storage_path, EVIDENCE_SIGNED_URL_TTL_SECONDS);

      if (error) {
        console.error('[complaints] signed url failed:', error.message);
      }

      return {
        id: item.id,
        fileName: item.file_name,
        fileType: item.file_type,
        fileSizeBytes: item.file_size_bytes,
        createdAt: item.created_at,
        url: data?.signedUrl ?? null,
      };
    })
  );
}

/**
 * Sensitive cases assigned to the caller (Female Focal Person, Proctor, Admin,
 * Counselor). Returns [] for anyone without an explicit assignment, which is
 * how unauthorized staff are kept out of harassment cases.
 *
 * Identity fields are redacted according to the complaint's privacy mode.
 */
export interface SensitiveCaseSummary {
  trackingId: string;
  title: string;
  status: Complaint['status'];
  priority: Complaint['priority'];
  immediateDanger: boolean;
  submittedAt: string;
  /** Real reporter id, or null when the privacy mode hides it from this user. */
  reporterId: string | null;
  reporterAlias: string | null;
}

export async function getAssignedSensitiveCases(
  userId: string
): Promise<SensitiveCaseSummary[]> {
  const admin = createAdminClient();

  const { data: assignments, error } = await admin
    .from('sensitive_case_access')
    .select('complaint_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[complaints] failed to load assignments:', error.message);
    return [];
  }

  const ids = (assignments ?? []).map((row) => row.complaint_id);
  if (ids.length === 0) return [];

  const { data: complaints, error: complaintsError } = await admin
    .from('complaints')
    .select(
      'id, tracking_id, student_id, title, status, priority, privacy_mode, immediate_danger, submitted_at'
    )
    .in('id', ids)
    .order('submitted_at', { ascending: false });

  if (complaintsError) {
    console.error('[complaints] failed to load cases:', complaintsError.message);
    return [];
  }

  const { data: privacyRows } = await admin
    .from('complaint_privacy')
    .select('complaint_id, anonymous_alias, exposed_to')
    .in('complaint_id', ids);

  const privacyByComplaint = new Map(
    (privacyRows ?? []).map((row) => [row.complaint_id, row])
  );

  return (complaints ?? []).map((row) => {
    const privacy = privacyByComplaint.get(row.id);
    const exposed = privacy?.exposed_to ?? [];

    // Identity exposure: anonymous → never; confidential → only assigned
    // handlers listed in exposed_to; identified → visible to the handler.
    const identityVisible =
      row.privacy_mode === 'identified' ||
      (row.privacy_mode === 'confidential' && exposed.includes(userId));

    return {
      trackingId: row.tracking_id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      immediateDanger: row.immediate_danger,
      submittedAt: row.submitted_at,
      reporterId: identityVisible ? row.student_id : null,
      reporterAlias: identityVisible
        ? null
        : (privacy?.anonymous_alias ?? 'Confidential reporter'),
    };
  });
}
