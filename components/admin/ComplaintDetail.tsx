'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Shield,
  Sparkles,
  UserCheck,
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
// Action Panel
// ---------------------------------------------------------------------------

function ActionPanel({
  trackingId,
  currentStatus,
  onAction,
}: {
  trackingId: string;
  currentStatus: ComplaintStatus;
  onAction: () => void;
}) {
  const router = useRouter();
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valid transitions for Sprint 5.
  const validTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
    submitted: ['assigned', 'in_review'],
    assigned: ['in_review', 'escalated'],
    in_review: ['action_taken', 'escalated'],
    action_taken: ['resolved'],
    resolved: ['reopened'],
    escalated: ['in_review', 'assigned'],
    reopened: ['in_review'],
  };

  const transitions = validTransitions[currentStatus] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newStatus) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: notes.trim() || undefined }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to change status');

      setNewStatus('');
      setNotes('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change status.');
    } finally {
      setSubmitting(false);
    }
  }

  if (transitions.length === 0) {
    return (
      <Alert tone="info" title="Terminal status">
        This complaint is {currentStatus === 'resolved' ? 'resolved' : 'in a terminal state'}.
        No further status changes are available.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="status-select"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Change status to
        </label>
        <select
          id="status-select"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a status...</option>
          {transitions.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="status-notes"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Notes (optional)
        </label>
        <textarea
          id="status-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add context about this change..."
        />
      </div>

      {error && (
        <Alert tone="error">{error}</Alert>
      )}

      <Button type="submit" disabled={!newStatus || submitting} loading={submitting}>
        {submitting ? 'Updating...' : 'Update Status'}
      </Button>
    </form>
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
    escalations,
    proofOfAction,
    identityVisible,
    studentName,
    studentAlias,
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

      {/* Action Panel — visible only when user can take action */}
      {detail.canTakeAction && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCheck className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Actions
          </h2>
          <div className="mt-4">
            <ActionPanel
              trackingId={complaint.tracking_id}
              currentStatus={complaint.status}
              onAction={refresh}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
