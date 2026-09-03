import type {
  AffiliationStatus,
  Profile,
  UserVerification,
  VerificationMethod,
} from '@/types/database';

/**
 * Verification state machine (SRS §7.1).
 *
 *   unverified
 *      │  university + student type selected, OTP requested
 *      ▼
 *   pending_email ──── email OTP confirmed ────► verified
 *      │
 *      │  (alternative / supplementary path)
 *      ▼
 *   pending_card ──── card OCR completed ─────► verified
 *                       (low confidence → verified + needs_manual_review)
 *
 *   any state ──── admin rejection ───────────► rejected ──► re-apply ──► unverified
 *
 * Email/OTP is the primary path; the student card is supplementary and never
 * blocks access on its own.
 */

export const AFFILIATION_STATUS_ORDER: AffiliationStatus[] = [
  'unverified',
  'pending_email',
  'pending_card',
  'verified',
];

export interface StatusPresentation {
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}

export const STATUS_PRESENTATION: Record<AffiliationStatus, StatusPresentation> = {
  unverified: {
    label: 'Not verified',
    description:
      'Start by telling us where you study, then confirm your university email.',
    tone: 'neutral',
  },
  pending_email: {
    label: 'Email verification pending',
    description:
      'We sent a 6-digit code to your university email. Enter it to finish verification.',
    tone: 'info',
  },
  pending_card: {
    label: 'Student card review pending',
    description:
      'Your student card is being processed. This usually finishes in a moment.',
    tone: 'warning',
  },
  verified: {
    label: 'Verified',
    description:
      'Your university affiliation is confirmed. You have full access to CampusAwaz.',
    tone: 'success',
  },
  rejected: {
    label: 'Verification rejected',
    description:
      'We could not confirm your university affiliation. Review the notes below and re-apply.',
    tone: 'danger',
  },
};

/** True when the profile grants access to protected areas. */
export function isVerified(profile: Pick<Profile, 'affiliation_status'> | null): boolean {
  return profile?.affiliation_status === 'verified';
}

/**
 * Advances affiliation status when an OTP is requested.
 * Verified users are never demoted by requesting a new code.
 */
export function statusAfterOtpRequested(current: AffiliationStatus): AffiliationStatus {
  if (current === 'verified') return 'verified';
  return 'pending_email';
}

/** Email OTP confirmation always grants verified status. */
export function statusAfterEmailConfirmed(): AffiliationStatus {
  return 'verified';
}

/**
 * Card OCR completion grants verified status regardless of confidence; low
 * confidence only sets `needs_manual_review` so an admin can revoke later.
 */
export function statusAfterCardProcessed(): AffiliationStatus {
  return 'verified';
}

/** Status while a card upload is in flight. */
export function statusWhileCardPending(current: AffiliationStatus): AffiliationStatus {
  if (current === 'verified') return 'verified';
  return 'pending_card';
}

export interface VerificationStep {
  slug: 'university' | 'status' | 'email' | 'card';
  title: string;
  description: string;
  href: string;
  complete: boolean;
  optional: boolean;
}

export interface VerificationProgressInput {
  profile: Pick<
    Profile,
    'affiliation_status' | 'university_id' | 'student_type'
  > | null;
  verifications: Pick<UserVerification, 'method' | 'status'>[];
}

export interface VerificationProgress {
  steps: VerificationStep[];
  /** Next incomplete required step, or null when everything required is done. */
  nextStep: VerificationStep | null;
  completedCount: number;
  requiredCount: number;
  emailVerified: boolean;
  cardVerified: boolean;
}

function hasVerified(
  verifications: Pick<UserVerification, 'method' | 'status'>[],
  method: VerificationMethod
): boolean {
  return verifications.some((v) => v.method === method && v.status === 'verified');
}

/** Computes the verification checklist shown on the hub + stepper. */
export function getVerificationProgress(
  input: VerificationProgressInput
): VerificationProgress {
  const { profile, verifications } = input;

  const emailVerified = hasVerified(verifications, 'email_otp');
  const cardVerified = hasVerified(verifications, 'student_card');
  const alreadyVerified = profile?.affiliation_status === 'verified';

  const steps: VerificationStep[] = [
    {
      slug: 'university',
      title: 'Select your university',
      description: 'Choose the institution you are affiliated with.',
      href: '/verify/university',
      complete: Boolean(profile?.university_id),
      optional: false,
    },
    {
      slug: 'status',
      title: 'Confirm your status',
      description: 'Tell us whether you are a current student or a graduate.',
      href: '/verify/status',
      complete: Boolean(profile?.student_type),
      optional: false,
    },
    {
      slug: 'email',
      title: 'Verify university email',
      description: 'Confirm a 6-digit code sent to your official email address.',
      href: '/verify/email',
      complete: emailVerified || (alreadyVerified && !cardVerified),
      optional: false,
    },
    {
      slug: 'card',
      title: 'Upload student card',
      description: 'Optional — adds an extra layer of proof to your account.',
      href: '/verify/card',
      complete: cardVerified,
      optional: true,
    },
  ];

  const requiredSteps = steps.filter((s) => !s.optional);
  const nextStep = requiredSteps.find((s) => !s.complete) ?? null;

  return {
    steps,
    nextStep,
    completedCount: steps.filter((s) => s.complete).length,
    requiredCount: requiredSteps.length,
    emailVerified,
    cardVerified,
  };
}

/**
 * Where a user should be sent next in the verification funnel.
 * Card upload is never forced — verified users go to the dashboard.
 */
export function nextVerificationHref(input: VerificationProgressInput): string {
  const { profile } = input;
  if (profile?.affiliation_status === 'verified') return '/dashboard';
  if (profile?.affiliation_status === 'rejected') return '/verify';

  const progress = getVerificationProgress(input);
  return progress.nextStep?.href ?? '/verify';
}
