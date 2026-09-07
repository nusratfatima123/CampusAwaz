/** Application-wide constants for CampusAwaz Sprint 1. */

export const APP_NAME = 'CampusAwaz';
export const APP_TAGLINE = 'Your Voice. Our Action.';
export const APP_DESCRIPTION =
  'A trusted platform for university students to report problems, seek support, and track real action — safely and confidentially.';

/** Files accepted for student-card verification. */
export const ALLOWED_CARD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_CARD_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** OTP rules. */
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const DEFAULT_OTP_TTL_SECONDS = 300;
export const DEFAULT_OCR_CONFIDENCE_THRESHOLD = 0.75;

export function getOtpTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.OTP_TTL_SECONDS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OTP_TTL_SECONDS;
}

export function getOcrConfidenceThreshold(): number {
  const parsed = Number.parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD ?? '');
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1
    ? parsed
    : DEFAULT_OCR_CONFIDENCE_THRESHOLD;
}

/** Complaint categories — landing-page copy only in Sprint 1. */
export const COMPLAINT_CATEGORY_PREVIEW = [
  'Academic',
  'Safety & Harassment',
  'Facilities',
  'Administration',
  'Hostel',
  'Mental Health',
] as const;

/** Verification step slugs, in the order they are presented. */
export const VERIFICATION_STEPS = [
  'university',
  'status',
  'email',
  'card',
  'done',
] as const;

export type VerificationStepSlug = (typeof VERIFICATION_STEPS)[number];

// ---------------------------------------------------------------------------
// Sprint 2 — complaints
// ---------------------------------------------------------------------------

/** Private Storage bucket holding complaint evidence. */
export const EVIDENCE_BUCKET = 'complaint-evidence';

/** MIME allow-list for complaint evidence (images + PDF). */
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_EVIDENCE_FILES = 5; // per complaint

/** Signed-URL lifetime for evidence previews. */
export const EVIDENCE_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export const COMPLAINT_TITLE_MIN = 8;
export const COMPLAINT_TITLE_MAX = 140;
export const COMPLAINT_DESCRIPTION_MIN = 30;
export const COMPLAINT_DESCRIPTION_MAX = 5000;

/** The one category key that triggers the protected safety workflow. */
export const SENSITIVE_CATEGORY_KEY = 'safety_harassment';

/** Steps in the standard complaint stepper. */
export const COMPLAINT_FORM_STEPS = [
  'Describe',
  'Privacy',
  'Evidence',
  'Review',
] as const;

// ---------------------------------------------------------------------------
// Sprint 3 — AI assistant & smart routing
// ---------------------------------------------------------------------------

/** Rate limits for the AI endpoints, per authenticated user. */
export const AI_ANALYZE_RATE_LIMIT = 30;
export const AI_GENERATE_RATE_LIMIT = 20;
export const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Shortest free-text input the assistant will accept. */
export const AI_INPUT_MIN = 20;
/** Longest text forwarded to a provider — also the prompt-injection length cap. */
export const AI_INPUT_MAX = 4000;

/** Provider timeout for a single AI call. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Below this overall confidence the UI nudges the student (and the admin) to
 * review the recommendation carefully. It never blocks submission.
 */
export const AI_LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Shared department key set seeded for every university by 003_ai_routing.sql. */
export const DEPARTMENT_KEYS = [
  'academic_affairs',
  'examinations',
  'student_affairs',
  'facilities',
  'hostel',
  'finance',
  'administration',
  'safety_proctor',
  'counseling',
  'it_services',
] as const;

/** Fallback labels used when a department row has not been seeded yet. */
export const DEPARTMENT_LABELS: Record<string, string> = {
  academic_affairs: 'Academic Affairs',
  examinations: 'Examinations Office',
  student_affairs: 'Student Affairs',
  facilities: 'Facilities Management',
  hostel: 'Hostel Administration',
  finance: 'Finance Office',
  administration: 'Central Administration',
  safety_proctor: 'Proctorial & Safety Office',
  counseling: 'Counseling & Wellbeing',
  it_services: 'IT Services',
};

/** Department that owns a case when nothing better can be determined. */
export const DEFAULT_DEPARTMENT_KEY = 'student_affairs';

/** Department that must own every harassment / safety case. */
export const SAFETY_DEPARTMENT_KEY = 'safety_proctor';

// ---------------------------------------------------------------------------
// Sprint 5 — escalation, resolution & feedback
// ---------------------------------------------------------------------------

/** Default SLA response windows in hours, keyed by priority. */
export const DEFAULT_SLA_HOURS: Record<string, number> = {
  critical: 24,
  high: 48,
  medium: 72,
  low: 168,
};

/** Shorter SLA windows for safety_harassment cases. */
export const SENSITIVE_SLA_HOURS: Record<string, number> = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 48,
};

/** Maximum escalation levels before the system stops auto-escalating. */
export const MAX_ESCALATION_LEVEL = 3;

/** Priority labels for SLA display. */
export const SLA_PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** SLA response hours by category and priority — mirrors the seeded sla_rules. */
export const SLA_REFERENCE_TABLE: Record<string, Record<string, number>> = {
  academic: { ...DEFAULT_SLA_HOURS },
  facilities: { ...DEFAULT_SLA_HOURS },
  hostel: { ...DEFAULT_SLA_HOURS },
  financial: { ...DEFAULT_SLA_HOURS },
  administration: { ...DEFAULT_SLA_HOURS },
  safety_harassment: { ...SENSITIVE_SLA_HOURS },
  mental_health: { ...DEFAULT_SLA_HOURS },
  other: { ...DEFAULT_SLA_HOURS },
};

/** Responsible authority for each complaint category. */
export const CATEGORY_AUTHORITY_LABELS: Record<string, string> = {
  academic: 'Dean — Academic Affairs',
  facilities: 'Director — Facilities',
  hostel: 'Chief Warden',
  financial: 'Director — Finance',
  administration: 'Central Administration',
  safety_harassment: 'Proctorial & Safety Office',
  mental_health: 'Counseling & Wellbeing',
  other: 'Central Administration',
};

/** Storage bucket for resolution evidence files. */
export const RESOLUTION_EVIDENCE_BUCKET = 'resolution-evidence';

/** MIME types accepted for resolution evidence uploads. */
export const ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_RESOLUTION_EVIDENCE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_RESOLUTION_EVIDENCE_FILES = 5;

/** Signed-URL lifetime for resolution evidence previews. */
export const RESOLUTION_EVIDENCE_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Feedback rating bounds. */
export const FEEDBACK_RATING_MIN = 1;
export const FEEDBACK_RATING_MAX = 5;
export const FEEDBACK_COMMENT_MAX = 2000;

// ---------------------------------------------------------------------------
// Sprint 6 — support, counseling, FAQ, analytics
// ---------------------------------------------------------------------------

/** Support resource type labels for display. */
export const SUPPORT_RESOURCE_TYPES = [
  'mental_health',
  'student_rights',
  'policy',
  'faq',
  'emergency',
  'general',
] as const;

export const SUPPORT_RESOURCE_LABELS: Record<string, string> = {
  mental_health: 'Mental Health',
  student_rights: 'Student Rights',
  policy: 'Policy',
  faq: 'FAQ',
  emergency: 'Emergency',
  general: 'General',
};

/** Counseling request statuses. */
export const COUNSELING_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'completed',
] as const;

export const COUNSELING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
};

/** FAQ category keys for filtering. */
export const FAQ_CATEGORIES = [
  'complaints',
  'privacy',
  'process',
  'tracking',
  'support',
  'safety',
] as const;

export const FAQ_CATEGORY_LABELS: Record<string, string> = {
  complaints: 'Complaints',
  privacy: 'Privacy',
  process: 'Process',
  tracking: 'Tracking',
  support: 'Support',
  safety: 'Safety',
};

/** Analytics cache TTL (client-side). */
export const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

/** Counseling request subject and message bounds. */
export const COUNSELING_SUBJECT_MIN = 5;
export const COUNSELING_SUBJECT_MAX = 200;
export const COUNSELING_MESSAGE_MIN = 20;
export const COUNSELING_MESSAGE_MAX = 5000;

/** FAQ assistant input bounds. */
export const FAQ_INPUT_MIN = 10;
export const FAQ_INPUT_MAX = 1000;
export const FAQ_RATE_LIMIT = 20;
