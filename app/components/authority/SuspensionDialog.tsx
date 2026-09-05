'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface SuspensionDialogProps {
  userName: string;
  roleName: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function SuspensionDialog({
  userName,
  roleName,
  onConfirm,
  onClose,
}: SuspensionDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (reason.trim().length < 5) {
      setError('Please provide a reason (at least 5 characters).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suspension-dialog-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="suspension-dialog-title" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Suspend Authority
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">
            You are about to suspend <strong>{userName}</strong> from the{' '}
            <strong>{roleName}</strong> role. This will immediately revoke their
            staff access.
          </p>

          <div>
            <label
              htmlFor="suspension-reason"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              id="suspension-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this authority is being suspended..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={handleConfirm}
              className="flex-1"
            >
              Suspend
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
