import { createAdminClient } from './supabase/admin';

/** Canonical audit event names used across Sprint 1. */
export const AUDIT_EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  VERIFICATION_UNIVERSITY_SELECTED: 'verification.university.selected',
  VERIFICATION_STATUS_SELECTED: 'verification.status.selected',
  VERIFICATION_EMAIL_SENT: 'verification.email.sent',
  VERIFICATION_EMAIL_CONFIRMED: 'verification.email.confirmed',
  VERIFICATION_EMAIL_FAILED: 'verification.email.failed',
  VERIFICATION_CARD_UPLOADED: 'verification.card.uploaded',
  VERIFICATION_CARD_OCR_COMPLETED: 'verification.card.ocr_completed',
  VERIFICATION_APPROVED: 'verification.approved',
  VERIFICATION_REJECTED: 'verification.rejected',
  VERIFICATION_RE_VERIFIED: 'verification.re_verified',
  // --- Sprint 2 — complaints ---
  COMPLAINT_SUBMITTED: 'complaint.submitted',
  COMPLAINT_PRIVACY_CHANGED: 'complaint.privacy_changed',
  COMPLAINT_EVIDENCE_UPLOADED: 'complaint.evidence_uploaded',
  COMPLAINT_SENSITIVE_CREATED: 'complaint.sensitive_created',
  // --- Sprint 3 — AI assistant & smart routing ---
  AI_ANALYSIS_REQUESTED: 'ai.analysis.requested',
  AI_DRAFT_GENERATED: 'ai.draft.generated',
  AI_RECOMMENDATION_LINKED: 'ai.recommendation.linked',
  AI_RECOMMENDATION_OVERRIDDEN: 'ai.recommendation.overridden',
  COMPLAINT_ASSIGNED: 'complaint.assigned',
  // --- Sprint 4 — tracking, assignments & notifications ---
  COMPLAINT_STATUS_CHANGED: 'complaint.status_changed',
  COMPLAINT_REASSIGNED: 'complaint.reassigned',
  SENSITIVE_CASE_VIEWED: 'complaint.sensitive_viewed',
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_READ_ALL: 'notification.read_all',
  // --- Sprint 5 — escalation, resolution & feedback ---
  COMPLAINT_ESCALATED: 'complaint.escalated',
  PROOF_OF_ACTION_CREATED: 'proof_of_action.created',
  COMPLAINT_REOPENED: 'complaint.reopened',
  FEEDBACK_SUBMITTED: 'feedback.submitted',
  RESOLUTION_EVIDENCE_UPLOADED: 'resolution.evidence_uploaded',
  // --- Sprint 6 — support, counseling, FAQ & analytics ---
  COUNSELING_REQUEST_CREATED: 'counseling.request.created',
  COUNSELING_REQUEST_ASSIGNED: 'counseling.request.assigned',
  COUNSELING_STATUS_CHANGED: 'counseling.status.changed',
  FAQ_ASSIST_REQUESTED: 'faq.assist.requested',
} as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS] | string;

export interface AuditOptions {
  userId?: string;
  actor?: 'system' | 'user' | 'admin';
  metadata?: Record<string, unknown>;
  request?: Request;
}

/** Best-effort client IP extraction from proxy headers. */
function clientIp(request?: Request): string | null {
  if (!request) return null;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? null;
}

/**
 * Writes an audit log row. Never throws — audit failures must not break user
 * flows, so errors are logged to the server console only.
 */
export async function audit(event: AuditEvent, opts: AuditOptions = {}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { error } = await admin.from('audit_logs').insert({
      user_id: opts.userId ?? null,
      event,
      actor: opts.actor ?? 'system',
      metadata: opts.metadata ?? null,
      ip_address: clientIp(opts.request),
      user_agent: opts.request?.headers.get('user-agent') ?? null,
    });

    if (error) {
      console.error(`[audit] failed to write "${event}":`, error.message);
    }
  } catch (err) {
    console.error(
      `[audit] failed to write "${event}":`,
      err instanceof Error ? err.message : err
    );
  }
}
