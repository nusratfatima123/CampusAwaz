'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, FileText, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { AuthorityRequestStatus, RoleName } from '@/types/database';

export interface ReviewRequestData {
  id: string;
  user_id: string;
  role_id: string;
  status: AuthorityRequestStatus;
  statement: string;
  evidence_path: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_reason: string | null;
  role_name: RoleName | null;
  user_name: string | null;
  user_phone: string | null;
}

const STATUS_TONES: Record<AuthorityRequestStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'neutral',
  reinstated: 'info',
};

export interface AuthorityReviewPanelProps {
  request: ReviewRequestData | null;
  onClose: () => void;
  onAction: () => void;
}

export function AuthorityReviewPanel({
  request,
  onClose,
  onAction,
}: AuthorityReviewPanelProps) {
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const requestId = request.id;
  const isPending = request.status === 'pending';

  async function handleApprove() {
    setActionLoading('approve');
    setError(null);
    try {
      const res = await fetch(`/api/authority/admin/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to approve.');
      setReason('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (reason.trim().length < 5) {
      setError('Please provide a reason (at least 5 characters).');
      return;
    }
    setActionLoading('reject');
    setError(null);
    try {
      const res = await fetch(`/api/authority/admin/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to reject.');
      setReason('');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-lg font-bold text-slate-900">Request Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close panel"
        >
          <XCircle className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <UserIcon className="h-5 w-5 text-blue-700" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {request.user_name ?? 'Unknown user'}
            </p>
            {request.user_phone ? (
              <p className="text-xs text-slate-500">{request.user_phone}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            {request.role_name ? roleLabel(request.role_name) : 'Unknown role'}
          </Badge>
          <Badge tone={STATUS_TONES[request.status]}>
            {request.status.replace('_', ' ')}
          </Badge>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Statement
          </h4>
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {request.statement}
          </p>
        </div>

        {request.evidence_path ? (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Supporting Document
            </h4>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="text-sm text-slate-600">Document attached</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Submitted</span>
            <p>{formatDate(request.created_at)}</p>
          </div>
          {request.reviewed_at ? (
            <div>
              <span className="font-semibold text-slate-700">Reviewed</span>
              <p>{formatDate(request.reviewed_at)}</p>
            </div>
          ) : null}
        </div>

        {request.review_reason ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Review Reason
            </h4>
            <p className="text-sm text-slate-600">{request.review_reason}</p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        {isPending ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label
                htmlFor="review-reason"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Reason (required for rejection)
              </label>
              <textarea
                id="review-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Optional for approval, required for rejection..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading === 'approve'}
                onClick={handleApprove}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading === 'reject'}
                onClick={handleReject}
                className="flex-1"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-4">
            <p className={cn(
              'text-center text-sm font-medium',
              request.status === 'approved' || request.status === 'reinstated'
                ? 'text-green-700'
                : request.status === 'rejected'
                  ? 'text-red-600'
                  : 'text-slate-500'
            )}>
              This request has been {request.status.replace('_', ' ')}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
