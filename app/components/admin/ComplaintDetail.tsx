'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Shield,
  Sparkles,
  UserCheck,
  UserPlus,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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
import { cn } from '@/lib/cn';
import { roleLabel } from '@/lib/roles';
import type { AssignableStaff } from '@/lib/routing';
import { filterStaffByCategory } from '@/lib/routing';
import type { ComplaintStatus, SlaDisplay, IdentityAccessRequest } from '@/types/database';

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
    storage_path: string;
    created_at: string;
  }[];
  feedback: {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  } | null;
  identityVisible: boolean;
  studentName: string | null;
  studentAlias: string | null;
  canTakeAction: boolean;
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
// Escalate Form
// ---------------------------------------------------------------------------

function EscalateForm({
  trackingId,
  onAction,
}: {
  trackingId: string;
  onAction: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to escalate complaint');

      setReason('');
      setExpanded(false);
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not escalate complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        Escalate
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="Explain why this complaint needs escalation (min 10 characters)..."
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex gap-2">
        <Button type="submit" disabled={reason.trim().length < 10 || submitting} loading={submitting}>
          {submitting ? 'Escalating...' : 'Confirm Escalation'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setExpanded(false);
            setReason('');
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Assignment Form (admin only)
// ---------------------------------------------------------------------------

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assigneeId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign complaint');

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="assignee-select"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Assign to
        </label>
        <select
          id="assignee-select"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a staff member...</option>
          {staff.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name} — {roleLabel(member.role)}
            </option>
          ))}
        </select>
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
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add context for the assignee..."
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" disabled={!assigneeId || submitting} loading={submitting}>
        {submitting ? 'Assigning...' : 'Assign Complaint'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Assignment History
// ---------------------------------------------------------------------------

function AssignmentHistory({ assignments }: { assignments: AssignmentEntry[] }) {
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-slate-500">No assignments yet.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {assignments.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">
            Assigned to: {entry.assigned_to ?? 'Unassigned'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatComplaintDateTime(entry.created_at)}
          </p>
          {entry.notes && (
            <p className="mt-1.5 text-sm text-slate-600">{entry.notes}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Identity Requests Panel
// ---------------------------------------------------------------------------

function identityRequestStatusLabel(status: string) {
  switch (status) {
    case 'pending': return 'Pending Admin Review';
    case 'admin_approved': return 'Pending Student Approval';
    case 'admin_denied': return 'Denied by Admin';
    case 'granted': return 'Granted';
    case 'denied': return 'Denied by Student';
    case 'expired': return 'Expired';
    default: return status;
  }
}

function identityRequestStatusTone(status: string): 'info' | 'warning' | 'danger' | 'success' | 'neutral' {
  switch (status) {
    case 'pending': return 'warning';
    case 'admin_approved': return 'info';
    case 'admin_denied': return 'danger';
    case 'granted': return 'success';
    case 'denied': return 'danger';
    case 'expired': return 'neutral';
    default: return 'neutral';
  }
}

function IdentityRequestsPanel({
  requests,
  complaintId,
  trackingId,
  isAdmin,
  isAssignedAuthority,
  onAction,
}: {
  requests: IdentityAccessRequest[];
  complaintId: string;
  trackingId: string;
  isAdmin: boolean;
  isAssignedAuthority: boolean;
  onAction: () => void;
}) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const hasActiveRequest = requests.some((r) =>
    ['pending', 'admin_approved', 'granted'].includes(r.status),
  );

  const canRequest = isAssignedAuthority && !hasActiveRequest;

  async function handleRequestAccess() {
    setRequesting(true);
    setRequestError(null);
    try {
      const res = await fetch('/api/identity-access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request');
      onAction();
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setRequesting(false);
    }
  }

  async function handleDecide(requestId: string, approve: boolean) {
    setActingId(requestId);
    setError(null);
    try {
      const res = await fetch('/api/identity-access/admin-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, approve, notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to process request');
      setNotes('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process request.');
    } finally {
      setActingId(null);
    }
  }

  const pendingRequest = requests.find((r) => r.status === 'pending');

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Eye className="h-5 w-5 text-blue-900" aria-hidden="true" />
        Identity Access Requests
      </h2>

      {canRequest && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-slate-700">
            You can request access to the reporter&apos;s identity. If approved by an
            admin, the student will be asked for final consent. Access expires after
            48 hours if granted.
          </p>
          <Button
            className="mt-3"
            onClick={handleRequestAccess}
            disabled={requesting}
            loading={requesting}
          >
            Request Identity Access
          </Button>
          {requestError && <Alert tone="error" className="mt-2">{requestError}</Alert>}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No identity access requests have been made for this complaint.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Requested by: {req.requested_by_role ? roleLabel(req.requested_by_role) : 'Authority'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatComplaintDateTime(req.created_at)}
                  </p>
                </div>
                <Badge tone={identityRequestStatusTone(req.status)}>
                  {identityRequestStatusLabel(req.status)}
                </Badge>
              </div>

              {req.admin_notes && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">Admin notes:</span> {req.admin_notes}
                </p>
              )}
              {req.student_notes && (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium">Student notes:</span> {req.student_notes}
                </p>
              )}

              {isAdmin && req.status === 'pending' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes (optional)..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleDecide(req.id, true)}
                      disabled={actingId !== null}
                      loading={actingId === req.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDecide(req.id, false)}
                      disabled={actingId !== null}
                      loading={actingId === req.id}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      {isAdmin && pendingRequest && (
        <p className="mt-3 text-xs text-slate-500">
          Approving will forward the request to the student for final consent.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Complaint Detail Component
// ---------------------------------------------------------------------------

export function ComplaintDetail({
  detail,
  staff = [],
  isAdmin = false,
  assignedTo = null,
}: {
  detail: ComplaintDetailData;
  staff?: AssignableStaff[];
  isAdmin?: boolean;
  assignedTo?: string | null;
}) {
  const router = useRouter();
  const {
    complaint,
    history,
    assignments,
    escalations,
    proofOfAction,
    identityVisible,
    studentName,
    studentAlias,
    slaDisplay,
    identityRequests = [],
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">SLA</p>
          {slaDisplay ? (
            <div className="mt-1 space-y-0.5">
              <Badge
                tone={
                  slaDisplay.state === 'breached'
                    ? 'danger'
                    : slaDisplay.state === 'overdue'
                      ? 'danger'
                      : slaDisplay.state === 'approaching'
                        ? 'warning'
                        : 'success'
                }
              >
                {slaDisplay.state === 'breached'
                  ? 'SLA Breached'
                  : slaDisplay.state === 'overdue'
                    ? `Overdue: ${Math.round(Math.abs(slaDisplay.hoursRemaining))}h`
                    : slaDisplay.state === 'approaching'
                      ? `${Math.round(slaDisplay.hoursRemaining)}h left`
                      : `${Math.round(slaDisplay.hoursRemaining)}h remaining`}
              </Badge>
              <p className="text-xs text-slate-500">
                {slaDisplay.responseHours}h response —{' '}
                {new Date(slaDisplay.responseDeadline).toLocaleString('en-PK', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-400">No SLA rule</p>
          )}
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
      {(complaint.privacy_mode === 'anonymous' || complaint.privacy_mode === 'confidential') && (
        <IdentityRequestsPanel
          requests={identityRequests}
          complaintId={complaint.id}
          trackingId={complaint.tracking_id}
          isAdmin={isAdmin}
          isAssignedAuthority={assignedTo === detail.viewerId}
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

      {/* Assignment — admin can assign, everyone with access can see history */}
      {isAdmin && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserPlus className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Assign Authority
          </h2>
          {assignedTo && (
            <Alert tone="info" className="mt-4">
              Currently assigned to a staff member. Reassigning will update the assignment record.
            </Alert>
          )}
          <div className="mt-4">
            <AssignmentForm
              trackingId={complaint.tracking_id}
              staff={filterStaffByCategory(staff, complaint.complaint_categories?.key ?? 'other')}
              onAction={refresh}
            />
          </div>
        </Card>
      )}

      {/* Assignment History */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900">Assignment History</h2>
        <div className="mt-4">
          <AssignmentHistory assignments={assignments} />
        </div>
      </Card>

      {/* Resolution Form — visible when complaint can be resolved and user can act */}
      {detail.canTakeAction && (complaint.status === 'assigned' || complaint.status === 'in_review') && (
        <ResolutionForm trackingId={complaint.tracking_id} onSuccess={refresh} />
      )}

      {/* Reopen Control — admin only */}
      {isAdmin && complaint.status === 'resolved' && (
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Reopen</h2>
          <div className="mt-4">
            <ReopenControl trackingId={complaint.tracking_id} onSuccess={refresh} />
          </div>
        </Card>
      )}

      {/* Escalate — admin only */}
      {isAdmin && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Actions
          </h2>
          <div className="mt-4">
            <EscalateForm
              trackingId={complaint.tracking_id}
              onAction={refresh}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
