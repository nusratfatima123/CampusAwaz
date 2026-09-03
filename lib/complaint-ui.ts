import type { BadgeTone } from '@/components/ui/Badge';
import type {
  ComplaintPriority,
  ComplaintStatus,
  PrivacyMode,
} from '@/types/database';

/**
 * Client-safe presentation helpers for complaints.
 *
 * Kept separate from `lib/complaints.ts` (which is server-only, service-role)
 * so Client Components can import labels without pulling in the admin client.
 */

export const COMPLAINT_STATUS_PRESENTATION: Record<
  ComplaintStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  submitted: {
    label: 'Submitted',
    tone: 'info',
    description: 'Received by CampusAwaz and waiting to be picked up.',
  },
  assigned: {
    label: 'Assigned',
    tone: 'info',
    description: 'A responsible officer now owns this case.',
  },
  in_review: {
    label: 'In review',
    tone: 'warning',
    description: 'The case is actively being looked into.',
  },
  action_taken: {
    label: 'Action taken',
    tone: 'purple',
    description: 'Corrective action has been recorded.',
  },
  resolved: {
    label: 'Resolved',
    tone: 'success',
    description: 'The case has been closed.',
  },
  escalated: {
    label: 'Escalated',
    tone: 'danger',
    description: 'Moved up to a higher authority.',
  },
  reopened: {
    label: 'Reopened',
    tone: 'warning',
    description: 'The case was reopened for further work.',
  },
};

export const PRIVACY_PRESENTATION: Record<
  PrivacyMode,
  { label: string; tone: BadgeTone; summary: string; detail: string }
> = {
  identified: {
    label: 'Identified',
    tone: 'neutral',
    summary: 'Your name is visible to the staff handling this case.',
    detail:
      'Fastest route to a resolution. Authorized staff can contact you directly for follow-up questions.',
  },
  confidential: {
    label: 'Confidential',
    tone: 'info',
    summary: 'Only the assigned handler can see who you are.',
    detail:
      'Your identity is stored but revealed only to the specific officer assigned to your case — nobody else in the university sees it.',
  },
  anonymous: {
    label: 'Anonymous',
    tone: 'purple',
    summary: 'No one sees your identity — you appear under an alias.',
    detail:
      'Handlers only see a system alias such as "Student-7A3F". You can still track progress with your tracking ID, but staff cannot contact you for extra details.',
  },
};

export const PRIORITY_PRESENTATION: Record<
  ComplaintPriority,
  { label: string; tone: BadgeTone }
> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};

export function statusLabel(status: ComplaintStatus | string): string {
  return (
    COMPLAINT_STATUS_PRESENTATION[status as ComplaintStatus]?.label ?? String(status)
  );
}

export function statusTone(status: ComplaintStatus | string): BadgeTone {
  return COMPLAINT_STATUS_PRESENTATION[status as ComplaintStatus]?.tone ?? 'neutral';
}

/** Short, locale-stable date used across complaint surfaces. */
export function formatComplaintDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatComplaintDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
