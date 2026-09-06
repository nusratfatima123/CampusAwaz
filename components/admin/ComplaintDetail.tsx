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
import { formatBytes } from '@/lib/validators';
import { cn } from '@/lib/cn';
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

function EscalatePanel({
  trackingId,
  slaDisplay,
  onAction,
}: {
  trackingId: string;
  slaDisplay: SlaDisplay | null | undefined;
  onAction: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const slaState = slaDisplay?.state ?? null;
  const hoursRemaining = slaDisplay?.hoursRemaining ?? null;
  const responseHours = slaDisplay?.responseHours ?? null;

  const slaIcon = slaState === 'breached' ? AlertTriangle : slaState === 'approaching' ? Timer : CheckCircle;
  const SlaIcon = slaIcon;
  const slaTone = slaState === 'breached' ? 'error' : slaState === 'approaching' ? 'warning' : 'success';

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
          slaState === 'approaching' ? 'border-amber-200 bg-amber-50' :
          'border-green-200 bg-green-50'
        )}>
          <div className="flex items-center gap-2">
            <SlaIcon className={cn(
              'h-5 w-5',
              slaState === 'breached' ? 'text-red-600' :
              slaState === 'approaching' ? 'text-amber-600' :
              'text-green-600'
            )} aria-hidden="true" />
            <span className={cn(
              'text-sm font-semibold',
              slaState === 'breached' ? 'text-red-800' :
              slaState === 'approaching' ? 'text-amber-800' :
              'text-green-800'
            )}>
              SLA {slaState === 'breached' ? 'Breached' : slaState === 'approaching' ? 'Approaching Deadline' : 'On Track'}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium">Response window:</span> {responseHours} hours
            </p>
            {hoursRemaining !== null && (
              <p>
                <span className="font-medium">
                  {slaState === 'breached' ? 'Overdue by:' : 'Time remaining:'}
                </span>{' '}
                {slaState === 'breached'
                  ? `${Math.abs(hoursRemaining)} hours overdue`
                  : `${hoursRemaining} hours remaining`}
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

interface AssignableStaffOption {
  userId: string;
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  hod: 'HOD',
  proctor: 'Proctor',
  female_focal_person: 'Female Focal Person',
  hostel_warden: 'Hostel Warden',
  counselor: 'Counselor',
  admin: 'Admin',
};

function AssignmentForm({
  trackingId,
  onAction,
}: {
  trackingId: string;
  onAction: () => void;
}) {
  const [staff, setStaff] = useState<AssignableStaffOption[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useState(() => {
    fetch('/api/complaints/admin/staff')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setStaff(json.staff);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  });

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

  if (loading) {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Assign Authority
        </h2>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4" />
          Loading staff list...
        </div>
      </Card>
    );
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
// Main Complaint Detail Component
// ---------------------------------------------------------------------------

export function ComplaintDetail({
  detail,
}: {
  detail: ComplaintDetailData;
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

      {/* Assignment Form — admin only, only when not yet assigned */}
      {isAdmin && !complaint.assigned_to && (
        <AssignmentForm trackingId={complaint.tracking_id} onAction={refresh} />
      )}

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
              onAction={refresh}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
