'use client';

import { useState } from 'react';
import { MessageCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import {
  COUNSELING_SUBJECT_MIN,
  COUNSELING_SUBJECT_MAX,
  COUNSELING_MESSAGE_MIN,
  COUNSELING_MESSAGE_MAX,
  COUNSELING_STATUS_LABELS,
} from '@/lib/constants';
import type { CounselingRequest, CounselingStatus } from '@/types/database';

const STATUS_TONE: Record<CounselingStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  pending: 'neutral',
  assigned: 'info',
  in_progress: 'warning',
  completed: 'success',
};

function statusBadgeTone(status: CounselingStatus) {
  return STATUS_TONE[status] ?? 'neutral';
}

export function CounselingForm({
  existingRequests,
}: {
  existingRequests: CounselingRequest[];
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requests, setRequests] = useState(existingRequests);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (trimmedSubject.length < COUNSELING_SUBJECT_MIN) {
      setError(`Subject must be at least ${COUNSELING_SUBJECT_MIN} characters.`);
      return;
    }
    if (trimmedMessage.length < COUNSELING_MESSAGE_MIN) {
      setError(`Message must be at least ${COUNSELING_MESSAGE_MIN} characters.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/support/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: trimmedSubject, message: trimmedMessage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request.');

      setRequests((prev) => [json.request, ...prev]);
      setSubject('');
      setMessage('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h3 className="text-lg font-bold text-slate-900">
            Request Counseling Support
          </h3>
        </div>
        <Alert tone="info" className="mb-4">
          Your request is completely anonymous. No identity information is shared with
          the counselor.
        </Alert>

        {success && (
          <Alert tone="success" title="Request submitted" className="mb-4">
            Your anonymous counseling request has been submitted. A counselor will be
            assigned shortly.
          </Alert>
        )}

        {error && (
          <Alert tone="error" title="Error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="counseling-subject"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Subject
            </label>
            <input
              id="counseling-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              minLength={COUNSELING_SUBJECT_MIN}
              maxLength={COUNSELING_SUBJECT_MAX}
              placeholder="Brief topic of your request"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="counseling-message"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Message
            </label>
            <textarea
              id="counseling-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              minLength={COUNSELING_MESSAGE_MIN}
              maxLength={COUNSELING_MESSAGE_MAX}
              placeholder="Describe what you'd like support with..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {message.length}/{COUNSELING_MESSAGE_MAX} characters
            </p>
          </div>
          <Button
            type="submit"
            loading={loading}
            disabled={
              subject.trim().length < COUNSELING_SUBJECT_MIN ||
              message.trim().length < COUNSELING_MESSAGE_MIN
            }
          >
            Submit Anonymously
          </Button>
        </form>
      </Card>

      {requests.length > 0 && (
        <Card>
          <h3 className="mb-4 text-base font-bold text-slate-900">Your Requests</h3>
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{req.subject}</p>
                  <Badge tone={statusBadgeTone(req.status)}>
                    {COUNSELING_STATUS_LABELS[req.status] ?? req.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{req.message}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
