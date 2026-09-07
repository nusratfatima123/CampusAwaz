'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Shield,
  Sparkles,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Timer,
  Paperclip,
  FileText,
  ExternalLink,
  Star,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { EscalationBanner } from '@/components/admin/EscalationBanner';
import { ResolutionForm } from '@/components/admin/ResolutionForm';
import { ReopenControl } from '@/components/admin/ReopenControl';
import {
  COMPLAINT_STATUS_PRESENTATION,
  PRIORITY_PRESENTATION,
  formatComplaintDate,
  formatComplaintDateTime,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import { formatBytes } from '@/lib/validators';
import { cn } from '@/lib/cn';
import type { AssignableStaff } from '@/lib/routing';
import type { ComplaintStatus, SlaDisplay, IdentityAccessRequest } from '@/types/database';
import type { RoleName } from '@/types/database';

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

function filterStaffByCategory(
  staff: AssignableStaff[],
  categoryKey: string,
): AssignableStaff[] {
  const relevantRoles = CATEGORY_RELEVANT_ROLES[categoryKey];
  if (!relevantRoles) return staff.filter((s) => s.role !== 'admin');
  const filtered = staff.filter((s) => relevantRoles.includes(s.role));
  // Fallback to hod if no staff match the category-specific roles
  if (filtered.length === 0) {
    const hodStaff = staff.filter((s) => s.role === 'hod');
    // If hod also has no staff, fall back to all non-admin staff
    if (hodStaff.length === 0) {
      return staff.filter((s) => s.role !== 'admin');
    }
    return hodStaff;
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  id: string;
  status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AssignmentEntry {
  id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  department_id: string | null;
  notes: string | null;
  created_at: string;
  assignee_name: string | null;
  assigned_by_name: string | null;
}

export interface ComplaintDetailData {
  complaint: {
    id: string;
    tracking_id: string;
    title: string;
    description: string;
    status: ComplaintStatus;
    priority: string;
    privacy_mode: string;
    is_sensitive: boolean;
    immediate_danger: boolean;
    submitted_at: string;
    updated_at: string;
    assigned_to: string | null;
    department_id: string | null;
    complaint_categories: { key: string; label: string } | null;
  };
  history: StatusHistoryEntry[];
  assignments: AssignmentEntry[];
  escalations: {
    id: string;
    escalated_by: string | null;
    escalated_to: string | null;
    reason: string;
    previous_status: string | null;
    new_status: string;
    level: number;
    created_at: string;
  }[];
  proofOfAction: {
    id: string;
    action_taken: string;
    resolution_explanation: string | null;
    created_at: string;
  } | null;
  resolutionEvidence: {
    id: string;
    file_name: string;
    file_type: string;
    storage_path?: string;
    url?: string | null;
    created_at: string;
  }[];
  feedback: {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  } | null;
  evidence: {
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    createdAt: string;
    url: string | null;
  }[];
  identityVisible: boolean;
  evidenceVisible: boolean;
  studentName: string | null;
  studentAlias: string | null;
  canTakeAction: boolean;
  isAdmin: boolean;
  viewerId?: string;
  slaDisplay?: SlaDisplay | null;
  identityRequests?: IdentityAccessRequest[];
}

// ---------------------------------------------------------------------------
// Status Timeline
// ---------------------------------------------------------------------------

function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No timeline entries yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-6 pl-8">
      <span
        aria-hidden="true"
        className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-0.5 rounded-full bg-slate-200"
      />
      {history.map((entry, index) => {
        const latest = index === history.length - 1;
        const meta = COMPLAINT_STATUS_PRESENTATION[entry.status as ComplaintStatus];

        return (
          <li key={entry.id} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                'absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                latest ? 'bg-blue-900 text-white' : 'bg-green-600 text-white',
              )}
            >
              <Clock className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-bold text-slate-900">
              {statusLabel(entry.status)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatComplaintDateTime(entry.created_at)}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {entry.notes ?? meta?.description ?? ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Escalate Panel
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function EscalatePanel({
  trackingId,
  slaDisplay,
  assignedAt,
  onAction,
}: {
  trackingId: string;
  slaDisplay: SlaDisplay | null | undefined;
  assignedAt?: string | null;
  onAction: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const slaState = slaDisplay?.state ?? null;
  const hoursRemaining = slaDisplay?.hoursRemaining ?? null;
  const responseHours = slaDisplay?.responseHours ?? null;

  const slaIcon = slaState === 'breached' || slaState === 'overdue' ? AlertTriangle : slaState === 'approaching' ? Timer : CheckCircle;
  const SlaIcon = slaIcon;
  const slaTone = slaState === 'breached' ? 'error' : slaState === 'overdue' ? 'error' : slaState === 'approaching' ? 'warning' : 'success';

  async function handleEscalate(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to escalate');

      setSuccess(true);
      setReason('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not escalate complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {slaDisplay && (
        <div className={cn(
          'rounded-xl border p-4',
          slaState === 'breached' ? 'border-red-200 bg-red-50' :
          slaState === 'overdue' ? 'border-orange-200 bg-orange-50' :
          slaState === 'approaching' ? 'border-amber-200 bg-amber-50' :
          'border-green-200 bg-green-50'
        )}>
          <div className="flex items-center gap-2">
            <SlaIcon className={cn(
              'h-5 w-5',
              slaState === 'breached' ? 'text-red-600' :
              slaState === 'overdue' ? 'text-orange-600' :
              slaState === 'approaching' ? 'text-amber-600' :
              'text-green-600'
            )} aria-hidden="true" />
            <span className={cn(
              'text-sm font-semibold',
              slaState === 'breached' ? 'text-red-800' :
              slaState === 'overdue' ? 'text-orange-800' :
              slaState === 'approaching' ? 'text-amber-800' :
              'text-green-800'
            )}>
              {slaState === 'breached' ? 'SLA Breached' :
               slaState === 'overdue' ? 'Overdue' :
               slaState === 'approaching' ? 'Approaching Deadline' :
               'On Track'}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium">SLA:</span> {responseHours} hours
            </p>
            {assignedAt && (
              <p>
                <span className="font-medium">Assigned:</span> {formatDateTime(assignedAt)}
              </p>
            )}
            {slaDisplay?.responseDeadline && (
              <p>
                <span className="font-medium">Deadline:</span> {formatDateTime(slaDisplay.responseDeadline)}
              </p>
            )}
            {hoursRemaining !== null && (
              <p>
                <span className="font-medium">
                  {slaState === 'breached' || slaState === 'overdue' ? 'Overdue by:' : 'Remaining:'}
                </span>{' '}
                {slaState === 'breached' || slaState === 'overdue'
                  ? `${Math.abs(hoursRemaining)} hours overdue`
                  : `${hoursRemaining} hours`}
              </p>
            )}
          </div>
        </div>
      )}

      {success && (
        <Alert tone="success">Complaint escalated successfully.</Alert>
      )}

      <form onSubmit={handleEscalate} className="space-y-4">
        <div>
          <label
            htmlFor="escalate-reason"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Reason for escalation
          </label>
          <textarea
            id="escalate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Explain why this complaint needs escalation (min. 10 characters)..."
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={reason.trim().length < 10 || submitting} loading={submitting}>
          {submitting ? 'Escalating...' : 'Escalate Complaint'}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignment Form
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  hod: 'HOD',
  proctor: 'Proctor',
  female_focal_person: 'Female Focal Person',
  hostel_warden: 'Hostel Warden',
  counselor: 'Counselor',
  finance_officer: 'Finance Officer',
  admin_officer: 'Administration Officer',
  admin: 'Admin',
};

function AssignmentForm({
  trackingId,
  staff,
  onAction,
}: {
  trackingId: string;
  staff: AssignableStaff[];
  onAction: () => void;
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigneeId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId, notes: notes.trim() || undefined }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign');

      setSuccess(true);
      setAssigneeId('');
      setNotes('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
        Assign Authority
      </h2>

      {success && (
        <Alert tone="success" className="mt-4">
          Complaint assigned successfully.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="assign-staff"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Select authority
          </label>
          <select
            id="assign-staff"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a staff member...</option>
            {staff.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name} — {ROLE_LABELS[s.role] ?? s.role}
              </option>
            ))}
          </select>
          {staff.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No verified staff available at your university.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="assign-notes"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Notes (optional)
          </label>
          <textarea
            id="assign-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add context for this assignment..."
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={!assigneeId || submitting} loading={submitting}>
          {submitting ? 'Assigning...' : 'Assign Complaint'}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Identity Access Panel
// ---------------------------------------------------------------------------

function identityStatusLabel(status: string): { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'purple' } {
  switch (status) {
    case 'pending':
      return { label: 'Pending admin review', tone: 'warning' };
    case 'admin_approved':
      return { label: 'Awaiting student decision', tone: 'info' };
    case 'admin_denied':
      return { label: 'Denied by admin', tone: 'danger' };
    case 'granted':
      return { label: 'Granted by student', tone: 'success' };
    case 'denied':
      return { label: 'Denied by student', tone: 'danger' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

function IdentityAccessPanel({
  complaintId,
  isAdmin,
  requests,
  onAction,
}: {
  complaintId: string;
  isAdmin: boolean;
  requests: IdentityAccessRequest[];
  onAction: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const activeRequest = requests.find(
    (r) => r.status === 'pending' || r.status === 'admin_approved',
  );
  const latestRequest = requests[0];

  async function handleRequest() {
    if (reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/complaints/identity-access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create request');
      setReason('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminDecision(action: 'approve' | 'deny') {
    if (!activeRequest) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/complaints/identity-access/${activeRequest.id}/admin-decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, notes: notes.trim() || undefined }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to process decision');
      setNotes('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process decision.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Shield className="h-5 w-5 text-blue-900" aria-hidden="true" />
        Identity Access
      </h2>

      <div className="mt-4 space-y-4">
        {latestRequest && (
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">
                <span className="font-medium">Latest request:</span>{' '}
                {formatComplaintDateTime(latestRequest.created_at)}
              </p>
              <Badge tone={identityStatusLabel(latestRequest.status).tone}>
                {identityStatusLabel(latestRequest.status).label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Requested by role: {latestRequest.requested_by_role}
            </p>
            {latestRequest.reason && (
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-medium">Reason:</span> {latestRequest.reason}
              </p>
            )}
            {latestRequest.admin_notes && (
              <p className="mt-1 text-xs text-slate-500">
                Admin notes: {latestRequest.admin_notes}
              </p>
            )}
            {latestRequest.student_notes && (
              <p className="mt-1 text-xs text-slate-500">
                Student notes: {latestRequest.student_notes}
              </p>
            )}
          </div>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        {/* Admin actions — approve/deny pending requests */}
        {isAdmin && activeRequest?.status === 'pending' && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              A staff member has requested access to the reporter&apos;s identity.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Optional notes..."
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleAdminDecision('approve')}
                disabled={submitting}
                loading={submitting}
              >
                Approve
              </Button>
              <Button
                onClick={() => handleAdminDecision('deny')}
                disabled={submitting}
                loading={submitting}
                variant="secondary"
              >
                Deny
              </Button>
            </div>
          </div>
        )}

        {/* Staff action — request identity access */}
        {!isAdmin && !activeRequest && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              The reporter&apos;s identity is hidden. You can request access to their identity.
              The student will review your request and make the final decision.
            </p>
            <div>
              <label htmlFor="identity-reason" className="block text-sm font-medium text-slate-700">
                Reason for requesting identity <span className="text-red-500">*</span>
              </label>
              <textarea
                id="identity-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Explain why you need access to the reporter's identity (minimum 10 characters)..."
              />
              <p className="mt-1 text-xs text-slate-500">
                Example: &quot;Identity is required to discuss additional information with the student during investigation.&quot;
              </p>
            </div>
            <Button
              onClick={handleRequest}
              disabled={submitting || reason.trim().length < 10}
              loading={submitting}
            >
              Request Identity Access
            </Button>
          </div>
        )}

        {!isAdmin && activeRequest && (
          <p className="text-sm text-slate-500">
            {activeRequest.status === 'pending'
              ? 'Your request is awaiting the student\'s decision.'
              : 'Your request has been approved by admin and is awaiting the student\'s decision.'}
          </p>
        )}

        {isAdmin && !activeRequest && latestRequest && (
          <p className="text-sm text-slate-500">
            No active identity access requests. The last request was{' '}
            {identityStatusLabel(latestRequest.status).label.toLowerCase()}.
          </p>
        )}

        {isAdmin && !activeRequest && !latestRequest && (
          <p className="text-sm text-slate-500">
            No identity access requests have been made for this complaint.
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Complaint Detail Component
// ---------------------------------------------------------------------------

export function ComplaintDetail({
  detail,
  staff = [],
  assignedTo = null,
}: {
  detail: ComplaintDetailData;
  staff?: AssignableStaff[];
  assignedTo?: string | null;
}) {
  const router = useRouter();
  const {
    complaint,
    history,
    assignments,
    escalations,
    proofOfAction,
    resolutionEvidence,
    feedback,
    evidence,
    identityVisible,
    evidenceVisible,
    studentName,
    studentAlias,
    slaDisplay,
    isAdmin,
    identityRequests,
  } = detail;
  const priorityMeta =
    PRIORITY_PRESENTATION[complaint.priority as keyof typeof PRIORITY_PRESENTATION];

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {complaint.tracking_id}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {complaint.title}
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Status</p>
          <Badge tone={statusTone(complaint.status)} className="mt-1">
            {statusLabel(complaint.status)}
          </Badge>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Priority</p>
          {priorityMeta && (
            <Badge tone={priorityMeta.tone} className="mt-1">
              {priorityMeta.label}
            </Badge>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Category</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {complaint.complaint_categories?.label ?? '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Submitted</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatComplaintDate(complaint.submitted_at)}
          </p>
        </Card>
      </div>

      {/* Escalation banner */}
      {complaint.status === 'escalated' && escalations.length > 0 && (
        <EscalationBanner escalations={escalations} />
      )}

      {/* Privacy and identity */}
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Shield className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Reporter Identity
        </h2>
        <div className="mt-4">
          <Badge tone={complaint.privacy_mode === 'anonymous' ? 'purple' : complaint.privacy_mode === 'confidential' ? 'info' : 'neutral'}>
            {complaint.privacy_mode === 'identified'
              ? 'Identified'
              : complaint.privacy_mode === 'confidential'
                ? 'Confidential'
                : 'Anonymous'}
          </Badge>
          <p className="mt-3 text-sm text-slate-700">
            {identityVisible && studentName ? (
              <span>
                <span className="font-semibold">Name:</span> {studentName}
              </span>
            ) : studentAlias ? (
              <span>
                <span className="font-semibold">Alias:</span> {studentAlias}
              </span>
            ) : (
              <span className="text-slate-500">Identity hidden</span>
            )}
          </p>
        </div>
        {complaint.is_sensitive && (
          <Alert tone="warning" className="mt-4">
            This is a sensitive case. Access is restricted to assigned handlers only.
          </Alert>
        )}
      </Card>

      {/* Identity Access Requests */}
      {!identityVisible && complaint.privacy_mode !== 'identified' && (
        <IdentityAccessPanel
          complaintId={complaint.id}
          isAdmin={isAdmin}
          requests={identityRequests ?? []}
          onAction={refresh}
        />
      )}

      {/* Description */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900">Description</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {complaint.description}
        </p>
      </Card>

      {/* Evidence */}
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Paperclip className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Evidence
          {evidenceVisible && evidence.length > 0 && (
            <span className="text-sm font-medium text-slate-400">
              ({evidence.length})
            </span>
          )}
        </h2>
        {!evidenceVisible ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <EyeOff className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-800">
              Evidence is hidden for confidential complaints. Only the assigned handler can view attached files.
            </p>
          </div>
        ) : evidence.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No evidence files attached.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {evidence.map((item) => {
              const isImage = item.fileType.startsWith('image/');
              return (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex h-32 items-center justify-center bg-slate-50">
                    {isImage && item.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.url}
                        alt={item.fileName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-slate-300" aria-hidden="true" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.fileName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatBytes(item.fileSizeBytes)}
                    </p>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-900 underline hover:text-blue-800"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-amber-600">
                        Preview unavailable
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Assignment Form — admin only, category-filtered */}
      {isAdmin && (() => {
        const filteredStaff = filterStaffByCategory(
          staff,
          complaint.complaint_categories?.key ?? 'other',
        );
        return (
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
              Assign Authority
            </h2>
            {(assignedTo ?? complaint.assigned_to) && (
              <Alert tone="info" className="mt-4">
                Currently assigned to a staff member. Reassigning will update the assignment record.
              </Alert>
            )}
            <div className="mt-4">
              {filteredStaff.length === 0 ? (
                <Alert tone="warning">
                  No staff members with the relevant authority role are available for this complaint category.
                </Alert>
              ) : (
                <AssignmentForm
                  trackingId={complaint.tracking_id}
                  staff={filteredStaff}
                  onAction={refresh}
                />
              )}
            </div>
          </Card>
        );
      })()}

      {/* Assignment History */}
      {assignments.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Users className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Assignment History
          </h2>
          <ol className="mt-4 space-y-3">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Assigned to:</span>{' '}
                  {a.assignee_name ?? 'Unassigned'}
                  {a.assigned_by_name && (
                    <span className="ml-2 text-slate-500">
                      by {a.assigned_by_name}
                    </span>
                  )}
                </p>
                {a.notes && (
                  <p className="mt-1 text-sm text-slate-600">{a.notes}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {formatComplaintDateTime(a.created_at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Proof of Action / Resolution */}
      {proofOfAction && (
        <Card className="border-green-200 bg-green-50/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-green-900">
                Resolution Details
              </h2>
              <p className="mt-0.5 text-xs text-green-700">
                Resolved on {formatComplaintDateTime(proofOfAction.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-green-700" aria-hidden="true" />
                Action Taken
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {proofOfAction.action_taken}
              </p>
            </div>

            {proofOfAction.resolution_explanation && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Explanation
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {proofOfAction.resolution_explanation}
                </p>
              </div>
            )}

            {resolutionEvidence.length > 0 && (
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Paperclip className="h-4 w-4 text-green-700" aria-hidden="true" />
                  Resolution Evidence
                  <span className="text-xs font-normal text-slate-500">
                    ({resolutionEvidence.length})
                  </span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {resolutionEvidence.map((file) => (
                    <li key={file.id}>
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-700 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-900"
                        >
                          {file.file_name}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-600">
                          {file.file_name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Student Feedback */}
      {feedback && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Star className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Student Feedback
          </h2>
          <div className="mt-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < feedback.rating
                      ? 'text-amber-500'
                      : 'text-slate-300'
                  }
                >
                  ★
                </span>
              ))}
              <span className="ml-2 text-sm font-medium text-slate-700">
                {feedback.rating}/5
              </span>
            </div>
            {feedback.comment && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {feedback.comment}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {formatComplaintDateTime(feedback.created_at)}
            </p>
          </div>
        </Card>
      )}

      {/* Status Timeline */}
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Clock className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Status Timeline
        </h2>
        <div className="mt-4">
          <StatusTimeline history={history} />
        </div>
      </Card>

      {/* Resolution Form — visible when complaint can be resolved and user can act */}
      {detail.canTakeAction && (complaint.status === 'assigned' || complaint.status === 'in_review') && (
        <ResolutionForm trackingId={complaint.tracking_id} onSuccess={refresh} />
      )}

      {/* Reopen Control — visible when complaint is resolved and user can act */}
      {detail.canTakeAction && complaint.status === 'resolved' && (
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Reopen</h2>
          <div className="mt-4">
            <ReopenControl trackingId={complaint.tracking_id} onSuccess={refresh} />
          </div>
        </Card>
      )}

      {/* Escalate Panel — visible only when user can take action */}
      {detail.canTakeAction && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Escalate
          </h2>
          <div className="mt-4">
            <EscalatePanel
              trackingId={complaint.tracking_id}
              slaDisplay={slaDisplay}
              assignedAt={assignments.length > 0 ? assignments[assignments.length - 1]?.created_at ?? null : null}
              onAction={refresh}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
