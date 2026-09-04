import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import { changeComplaintStatus } from './complaint-management';
import { MAX_ESCALATION_LEVEL, SLA_APPROACHING_THRESHOLD } from './constants';
import type {
  Complaint,
  ComplaintPriority,
  Escalation,
  RoleName,
  SlaDisplay,
  SlaRule,
} from '@/types/database';

/**
 * Server-side escalation & SLA helpers.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// SLA lookup
// ---------------------------------------------------------------------------

/**
 * Returns the SLA rule that applies to a given complaint, or null when no
 * matching rule exists.
 */
export async function getSlaRule(
  universityId: string,
  categoryKey: string | null,
  priority: ComplaintPriority,
): Promise<SlaRule | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('sla_rules')
    .select('id, university_id, category_key, priority, response_hours, escalation_level, is_active, created_at')
    .eq('university_id', universityId)
    .eq('priority', priority)
    .eq('is_active', true)
    .order('category_key', { ascending: true })
    .limit(1);

  const rows = (data ?? []) as unknown as SlaRule[];

  if (rows.length === 0) return null;

  const specific = rows.find((r) => r.category_key === categoryKey);
  return specific ?? rows[0] ?? null;
}

/**
 * Checks whether a complaint has exceeded its SLA window.
 */
export async function isSlaBreached(
  complaint: Pick<Complaint, 'id' | 'university_id' | 'category_id' | 'priority' | 'submitted_at' | 'updated_at'>,
  categoryKey: string | null,
): Promise<{ breached: boolean; slaRule: SlaRule | null; hoursOverdue: number }> {
  if (!complaint.university_id) return { breached: false, slaRule: null, hoursOverdue: 0 };

  const rule = await getSlaRule(complaint.university_id, categoryKey, complaint.priority);
  if (!rule) return { breached: false, slaRule: null, hoursOverdue: 0 };

  const submittedAt = new Date(complaint.submitted_at).getTime();
  const now = Date.now();
  const hoursElapsed = (now - submittedAt) / (1000 * 60 * 60);
  const hoursOverdue = Math.max(0, hoursElapsed - rule.response_hours);

  return {
    breached: hoursOverdue > 0,
    slaRule: rule,
    hoursOverdue: Math.round(hoursOverdue * 10) / 10,
  };
}

/**
 * Computes the SLA display state for a complaint — used by the UI to show
 * on_track / approaching / breached indicators.
 */
export async function getSlaDisplay(
  complaint: Pick<Complaint, 'id' | 'university_id' | 'category_id' | 'priority' | 'submitted_at' | 'updated_at'>,
  categoryKey: string | null,
): Promise<SlaDisplay | null> {
  if (!complaint.university_id) return null;

  const rule = await getSlaRule(complaint.university_id, categoryKey, complaint.priority);
  if (!rule) return null;

  const submittedAt = new Date(complaint.submitted_at).getTime();
  const now = Date.now();
  const deadlineMs = submittedAt + rule.response_hours * 60 * 60 * 1000;
  const hoursRemaining = (deadlineMs - now) / (1000 * 60 * 60);

  let state: SlaDisplay['state'] = 'on_track';
  if (hoursRemaining <= 0) {
    state = 'breached';
  } else if (hoursRemaining <= rule.response_hours * SLA_APPROACHING_THRESHOLD) {
    state = 'approaching';
  }

  return {
    state,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    responseDeadline: new Date(deadlineMs).toISOString(),
    responseHours: rule.response_hours,
  };
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

/** Role hierarchy for escalation targets. */
const ESCALATION_ROLE_ORDER: RoleName[] = [
  'hod',
  'proctor',
  'admin',
  'counselor',
];

export interface EscalateComplaintInput {
  trackingId: string;
  reason: string;
  actor: { userId: string; roles: RoleName[]; universityId: string };
  /** When true, the escalation was triggered by the SLA scanner (system). */
  isAutomatic?: boolean;
}

/**
 * Escalates a complaint to the next authorized higher authority.
 *
 * - Creates an escalation record.
 * - Changes the complaint status to 'escalated'.
 * - Notifies the target and the student.
 * - For sensitive (harassment) cases, only follows the restricted path.
 */
export async function escalateComplaint(
  input: EscalateComplaintInput,
  request?: Request,
): Promise<{ escalation: Escalation; escalatedTo: string | null }> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, status, priority, is_sensitive, category_id, assigned_to, department_id')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.university_id !== input.actor.universityId) throw new Error('Complaint not found.');

  const validFrom = ['assigned', 'in_review'];
  if (!validFrom.includes(complaint.status)) {
    throw new Error(`Cannot escalate from status "${complaint.status}".`);
  }

  // Check current escalation level.
  const { data: existingEscalations } = await admin
    .from('escalations')
    .select('id, level')
    .eq('complaint_id', complaint.id)
    .order('level', { ascending: false })
    .limit(1);

  const currentLevel = ((existingEscalations ?? []) as { id: string; level: number }[])[0]?.level ?? 0;
  if (currentLevel >= MAX_ESCALATION_LEVEL) {
    throw new Error('Maximum escalation level reached.');
  }

  // Find escalation target: next role in hierarchy not already involved.
  let escalatedTo: string | null = null;

  if (complaint.is_sensitive) {
    // Sensitive cases follow restricted path: FFP → Proctor → Admin → Counselor.
    const sensitivePath: RoleName[] = ['female_focal_person', 'proctor', 'admin', 'counselor'];
    for (const role of sensitivePath) {
      if (role === input.actor.roles.find((r) => r === role)) continue;

      const { data: roleRow } = await admin
        .from('roles')
        .select('id')
        .eq('name', role)
        .limit(1)
        .maybeSingle();

      if (!roleRow) continue;

      const { data: candidates } = await admin
        .from('user_roles')
        .select('user_id, roles ( name )')
        .eq('university_id', complaint.university_id)
        .eq('role_id', (roleRow as { id: string }).id);

      const rows = (candidates ?? []) as unknown as { user_id: string; roles: { name: RoleName } | null }[];
      const candidate = rows.find((r) => r.user_id !== complaint.assigned_to && r.user_id !== input.actor.userId);
      if (candidate) {
        escalatedTo = candidate.user_id;
        break;
      }
    }
  } else {
    for (const role of ESCALATION_ROLE_ORDER) {
      const { data: roleRow } = await admin
        .from('roles')
        .select('id')
        .eq('name', role)
        .limit(1)
        .maybeSingle();

      if (!roleRow) continue;

      const { data: candidates } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('university_id', complaint.university_id)
        .eq('role_id', (roleRow as { id: string }).id);

      const rows = (candidates ?? []) as { user_id: string }[];
      const candidate = rows.find((r) => r.user_id !== complaint.assigned_to && r.user_id !== input.actor.userId);
      if (candidate) {
        escalatedTo = candidate.user_id;
        break;
      }
    }
  }

  // Get category key for the SLA rule lookup.
  let categoryKey: string | null = null;
  if (complaint.category_id) {
    const { data: cat } = await admin
      .from('complaint_categories')
      .select('key')
      .eq('id', complaint.category_id)
      .maybeSingle();
    categoryKey = (cat as { key: string } | null)?.key ?? null;
  }

  // Check SLA.
  const slaCheck = await isSlaBreached(
    { ...complaint, category_id: complaint.category_id } as Complaint,
    categoryKey,
  );

  // Insert escalation record.
  const { data: escalationRow, error } = await admin
    .from('escalations')
    .insert({
      complaint_id: complaint.id,
      escalated_by: input.actor.userId,
      escalated_to: escalatedTo,
      reason: input.reason,
      previous_status: complaint.status,
      new_status: 'escalated',
      sla_rule_id: slaCheck.slaRule?.id ?? null,
      level: currentLevel + 1,
    })
    .select('id, complaint_id, escalated_by, escalated_to, reason, previous_status, new_status, sla_rule_id, level, created_at')
    .single();

  if (error) throw new Error(`Failed to create escalation: ${error.message}`);

  const escalation = escalationRow as unknown as Escalation;

  // Change status via the existing workflow.
  await changeComplaintStatus(
    {
      trackingId: input.trackingId,
      newStatus: 'escalated',
      notes: input.reason,
      actor: input.actor,
    },
    request,
  );

  // Notify escalation target.
  if (escalatedTo) {
    await createNotification(
      {
        userId: escalatedTo,
        type: 'escalation',
        complaintId: complaint.id,
        title: 'Complaint escalated to you',
        body: `A complaint (${complaint.tracking_id}) has been escalated for your attention. Reason: ${input.reason}`,
        trackingId: complaint.tracking_id,
      },
      request,
    );
  }

  // Notify student.
  await createNotification(
    {
      userId: complaint.student_id,
      type: 'escalation',
      complaintId: complaint.id,
      title: 'Your complaint has been escalated',
      body: `Your complaint ${complaint.tracking_id} has been escalated to a higher authority for further review.`,
      trackingId: complaint.tracking_id,
    },
    request,
  );

  await audit(AUDIT_EVENTS.COMPLAINT_ESCALATED, {
    userId: input.actor.userId,
    actor: input.isAutomatic ? 'system' : 'admin',
    metadata: {
      tracking_id: complaint.tracking_id,
      escalation_id: escalation.id,
      escalated_to: escalatedTo,
      level: escalation.level,
      reason: input.reason,
      is_automatic: input.isAutomatic ?? false,
    },
    request,
  });

  return { escalation, escalatedTo };
}

// ---------------------------------------------------------------------------
// SLA scanner (callable endpoint)
// ---------------------------------------------------------------------------

/**
 * Scans all open complaints for the university and escalates those that have
 * breached their SLA window. Returns the number of complaints escalated.
 */
export async function runSlaEscalationScan(
  universityId: string,
): Promise<{ scanned: number; escalated: number }> {
  const admin = createAdminClient();

  const { data: complaints } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, status, priority, is_sensitive, category_id, submitted_at, updated_at')
    .eq('university_id', universityId)
    .in('status', ['assigned', 'in_review']);

  const rows = (complaints ?? []) as unknown as (Complaint & { category_id: string | null })[];
  let escalated = 0;

  for (const complaint of rows) {
    let categoryKey: string | null = null;
    if (complaint.category_id) {
      const { data: cat } = await admin
        .from('complaint_categories')
        .select('key')
        .eq('id', complaint.category_id)
        .maybeSingle();
      categoryKey = (cat as { key: string } | null)?.key ?? null;
    }

    const { breached } = await isSlaBreached(complaint, categoryKey);
    if (!breached) continue;

    // Check if already escalated at max level.
    const { data: existingEsc } = await admin
      .from('escalations')
      .select('level')
      .eq('complaint_id', complaint.id)
      .order('level', { ascending: false })
      .limit(1);

    const maxLevel = ((existingEsc ?? []) as { level: number }[])[0]?.level ?? 0;
    if (maxLevel >= MAX_ESCALATION_LEVEL) continue;

    try {
      await escalateComplaint(
        {
          trackingId: complaint.tracking_id,
          reason: `SLA breach detected — complaint exceeded the configured response window for ${complaint.priority} priority.`,
          actor: {
            userId: complaint.assigned_to ?? complaint.student_id,
            roles: ['admin'],
            universityId,
          },
          isAutomatic: true,
        },
      );
      escalated++;
    } catch (err) {
      console.error(
        `[sla-scanner] failed to escalate ${complaint.tracking_id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { scanned: rows.length, escalated };
}

// ---------------------------------------------------------------------------
// Escalation history
// ---------------------------------------------------------------------------

export async function getEscalations(
  complaintId: string,
): Promise<Escalation[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('escalations')
    .select('id, complaint_id, escalated_by, escalated_to, reason, previous_status, new_status, sla_rule_id, level, created_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as Escalation[];
}
