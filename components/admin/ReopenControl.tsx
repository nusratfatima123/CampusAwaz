'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface ReopenControlProps {
  trackingId: string;
  onSuccess: () => void;
}

export function ReopenControl({ trackingId, onSuccess }: ReopenControlProps) {
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/admin/${trackingId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to reopen complaint');

      setReason('');
      setShowForm(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reopen complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!showForm) {
    return (
      <div>
        <Button
          variant="secondary"
          onClick={() => setShowForm(true)}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Reopen Complaint
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-bold text-amber-900">
        Reopen this complaint?
      </h3>
      <p className="mt-1 text-xs text-amber-800">
        This will move the complaint back to active review. Provide a reason for
        reopening.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label
            htmlFor="reopen-reason"
            className="mb-1 block text-sm font-medium text-amber-900"
          >
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Why does this complaint need to be reopened?"
            required
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={reason.trim().length < 10 || submitting}
            loading={submitting}
          >
            {submitting ? 'Reopening...' : 'Confirm Reopen'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForm(false);
              setReason('');
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
