'use client';

import { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { roleLabel } from '@/lib/roles';

interface IdentityPermissionCardProps {
  requestId: string;
  requestedByRole: string;
  reason: string | null;
  trackingId: string;
  status: string;
}

export function IdentityPermissionCard({
  requestId,
  requestedByRole,
  reason,
  trackingId,
  status,
}: IdentityPermissionCardProps) {
  const [deciding, setDeciding] = useState<'grant' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'granted' | 'denied' | null>(
    status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : null,
  );

  const canDecide = status === 'pending' || status === 'admin_approved';

  async function handleDecide(action: 'grant' | 'deny') {
    setDeciding(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/complaints/identity-access/${requestId}/student-decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            notes: notes.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to process request');
      setDecision(action === 'grant' ? 'granted' : 'denied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process request.');
    } finally {
      setDeciding(null);
    }
  }

  if (decision) {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {decision === 'granted' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          ) : (
            <XCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />
          )}
          Identity Access Request
        </h2>
        <Alert
          tone={decision === 'granted' ? 'success' : 'info'}
          className="mt-4"
        >
          {decision === 'granted'
            ? 'You have granted identity access. The assigned authority can now see your identity.'
            : 'You have denied the identity access request. Your identity remains protected.'}
        </Alert>
      </Card>
    );
  }

  if (!canDecide) {
    return null;
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
        Identity Access Request
      </h2>

      <dl className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Complaint
          </dt>
          <dd className="mt-1 font-mono font-semibold text-blue-900">
            {trackingId}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Requested by
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {roleLabel(requestedByRole).toLowerCase()}
          </dd>
        </div>
      </dl>

      {reason ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reason
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            {reason}
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        The {roleLabel(requestedByRole).toLowerCase()} assigned to your case is
        requesting to see your real identity. If you grant this, they will be able
        to see your name. You can add optional notes with your decision.
      </p>

      <div className="mt-4">
        <label
          htmlFor="identity-notes"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Notes (optional)
        </label>
        <textarea
          id="identity-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add a message for the handler..."
        />
      </div>

      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      <div className="mt-4 flex gap-3">
        <Button
          onClick={() => handleDecide('grant')}
          disabled={deciding !== null}
          loading={deciding === 'grant'}
        >
          Grant Access
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleDecide('deny')}
          disabled={deciding !== null}
          loading={deciding === 'deny'}
        >
          Deny
        </Button>
      </div>
    </Card>
  );
}
