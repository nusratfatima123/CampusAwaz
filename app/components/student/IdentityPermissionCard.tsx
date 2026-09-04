'use client';

import { useState } from 'react';
import { ShieldAlert, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { roleLabel } from '@/lib/roles';

interface IdentityPermissionCardProps {
  requestId: string;
  requestedByRole: string;
}

export function IdentityPermissionCard({
  requestId,
  requestedByRole,
}: IdentityPermissionCardProps) {
  const [deciding, setDeciding] = useState<'grant' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'granted' | 'denied' | null>(null);

  async function handleDecide(approve: boolean) {
    setDeciding(approve ? 'grant' : 'deny');
    setError(null);
    try {
      const res = await fetch('/api/identity-access/student-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          approve,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to process request');
      setDecision(approve ? 'granted' : 'denied');
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
          <Eye className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Identity Access Request
        </h2>
        <Alert
          tone={decision === 'granted' ? 'success' : 'info'}
          className="mt-4"
        >
          {decision === 'granted'
            ? 'You have granted identity access. The assigned authority can now see your identity for the next 48 hours.'
            : 'You have denied the identity access request. Your identity remains protected.'}
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
        Identity Access Request
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        The {roleLabel(requestedByRole).toLowerCase()} assigned to your case is
        requesting to see your real identity. If you grant this, they will be able
        to see your name for <strong>48 hours</strong>, after which access
        automatically expires.
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
          onClick={() => handleDecide(true)}
          disabled={deciding !== null}
          loading={deciding === 'grant'}
        >
          Grant Access
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleDecide(false)}
          disabled={deciding !== null}
          loading={deciding === 'deny'}
        >
          Deny
        </Button>
      </div>
    </Card>
  );
}
