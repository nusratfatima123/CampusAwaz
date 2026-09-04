import {
  AI_INPUT_MAX,
  AI_INPUT_MIN,
  ALLOWED_CARD_MIME_TYPES,
  ALLOWED_EVIDENCE_MIME_TYPES,
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_DESCRIPTION_MIN,
  COMPLAINT_TITLE_MAX,
  COMPLAINT_TITLE_MIN,
  DEPARTMENT_KEYS,
  MAX_CARD_FILE_BYTES,
  MAX_EVIDENCE_FILE_BYTES,
  MAX_EVIDENCE_FILES,
  OTP_LENGTH,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Basic RFC-ish email shape check. */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required.' };
  if (!EMAIL_RE.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }
  return { valid: true };
}

/** Extracts the lower-cased domain part of an email, or null when malformed. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Checks an email against a university's allowed domain list.
 * A subdomain of an allowed domain is accepted (e.g. `sdc.lums.edu.pk` passes
 * when `lums.edu.pk` is allowed).
 */
export function validateEmailForUniversity(
  email: string,
  allowedDomains: string[]
): ValidationResult {
  const shape = validateEmail(email);
  if (!shape.valid) return shape;

  const domain = emailDomain(email);
  if (!domain) return { valid: false, error: 'Enter a valid email address.' };

  if (allowedDomains.length === 0) {
    return {
      valid: false,
      error: 'No official email domains are configured for this university yet.',
    };
  }

  const normalized = allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  const matches = normalized.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );

  if (!matches) {
    return {
      valid: false,
      error: `Use your official university email. Accepted domains: ${normalized.join(', ')}.`,
    };
  }

  return { valid: true };
}

/** Password policy: min 8 chars, at least one letter and one digit. */
export function validatePassword(pw: string): ValidationResult {
  if (!pw) return { valid: false, error: 'Password is required.' };
  if (pw.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' };
  }
  if (!/[A-Za-z]/.test(pw)) {
    return { valid: false, error: 'Password must include at least one letter.' };
  }
  if (!/\d/.test(pw)) {
    return { valid: false, error: 'Password must include at least one number.' };
  }
  return { valid: true };
}

/** OTP must be exactly N digits. */
export function validateOtp(code: string): ValidationResult {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, error: 'Enter the verification code.' };
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(trimmed)) {
    return { valid: false, error: `The code must be ${OTP_LENGTH} digits.` };
  }
  return { valid: true };
}

export function validateFullName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'Full name is required.' };
  if (trimmed.length < 3) {
    return { valid: false, error: 'Please enter your full name.' };
  }
  if (trimmed.length > 120) {
    return { valid: false, error: 'Name is too long.' };
  }
  return { valid: true };
}

interface CardFileLike {
  type: string;
  size: number;
  name?: string;
}

/** Validates a student-card upload: MIME type + size. */
export function validateCardFile(file: CardFileLike): ValidationResult {
  if (!file) return { valid: false, error: 'Select a file to upload.' };

  const allowed = ALLOWED_CARD_MIME_TYPES as readonly string[];
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Upload a JPG, PNG, WEBP image or a PDF.',
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }

  if (file.size > MAX_CARD_FILE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${formatBytes(file.size)}). Maximum size is 5 MB.`,
    };
  }

  return { valid: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Maps a MIME type to a storage file extension. */
export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

// ---------------------------------------------------------------------------
// Sprint 2 — complaints
// ---------------------------------------------------------------------------

/** Validates a single complaint-evidence file: MIME allow-list + size. */
export function validateEvidenceFile(file: CardFileLike): ValidationResult {
  if (!file) return { valid: false, error: 'Select a file to upload.' };

  const allowed = ALLOWED_EVIDENCE_MIME_TYPES as readonly string[];
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: `"${file.name ?? 'File'}" is not a supported type. Upload a JPG, PNG, WEBP image or a PDF.`,
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: `"${file.name ?? 'File'}" is empty.` };
  }

  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return {
      valid: false,
      error: `"${file.name ?? 'File'}" is too large (${formatBytes(file.size)}). Maximum size is ${formatBytes(MAX_EVIDENCE_FILE_BYTES)}.`,
    };
  }

  return { valid: true };
}

/** Validates a whole evidence set: count limit plus every individual file. */
export function validateEvidenceSet(files: CardFileLike[]): ValidationResult {
  if (files.length > MAX_EVIDENCE_FILES) {
    return {
      valid: false,
      error: `You can attach at most ${MAX_EVIDENCE_FILES} files to one complaint.`,
    };
  }

  for (const file of files) {
    const check = validateEvidenceFile(file);
    if (!check.valid) return check;
  }

  return { valid: true };
}

export function validateComplaintTitle(title: string): ValidationResult {
  const trimmed = title.trim();
  if (!trimmed) return { valid: false, error: 'A short summary is required.' };
  if (trimmed.length < COMPLAINT_TITLE_MIN) {
    return {
      valid: false,
      error: `Summary must be at least ${COMPLAINT_TITLE_MIN} characters.`,
    };
  }
  if (trimmed.length > COMPLAINT_TITLE_MAX) {
    return {
      valid: false,
      error: `Summary must be ${COMPLAINT_TITLE_MAX} characters or fewer.`,
    };
  }
  return { valid: true };
}

export function validateComplaintDescription(description: string): ValidationResult {
  const trimmed = description.trim();
  if (!trimmed) return { valid: false, error: 'A description is required.' };
  if (trimmed.length < COMPLAINT_DESCRIPTION_MIN) {
    return {
      valid: false,
      error: `Please add more detail — at least ${COMPLAINT_DESCRIPTION_MIN} characters.`,
    };
  }
  if (trimmed.length > COMPLAINT_DESCRIPTION_MAX) {
    return {
      valid: false,
      error: `Description must be ${COMPLAINT_DESCRIPTION_MAX} characters or fewer.`,
    };
  }
  return { valid: true };
}

const PRIVACY_MODES = ['identified', 'confidential', 'anonymous'] as const;

export function validatePrivacyMode(mode: string): ValidationResult {
  if (!(PRIVACY_MODES as readonly string[]).includes(mode)) {
    return { valid: false, error: 'Select a valid privacy mode.' };
  }
  return { valid: true };
}

/** Tracking-id shape guard used before hitting the database. */
const TRACKING_ID_RE = /^CA-[A-Z0-9-]{2,20}-\d{4}-\d{5,}$/;

export function isTrackingIdShape(value: string): boolean {
  return TRACKING_ID_RE.test(value.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// Sprint 3 — AI assistant & smart routing
// ---------------------------------------------------------------------------

/** Free-text input accepted by the AI assistant. */
export function validateAiInput(text: string): ValidationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, error: 'Describe the problem so the assistant can help.' };
  }
  if (trimmed.length < AI_INPUT_MIN) {
    return {
      valid: false,
      error: `Add a little more detail — at least ${AI_INPUT_MIN} characters.`,
    };
  }
  if (trimmed.length > AI_INPUT_MAX) {
    return {
      valid: false,
      error: `Keep it under ${AI_INPUT_MAX} characters for the assistant.`,
    };
  }
  return { valid: true };
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export function validatePriority(priority: string): ValidationResult {
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    return { valid: false, error: 'Select a valid priority.' };
  }
  return { valid: true };
}

export function isDepartmentKey(key: string): boolean {
  return (DEPARTMENT_KEYS as readonly string[]).includes(key);
}

/** UUID shape guard for ids arriving from the browser. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
