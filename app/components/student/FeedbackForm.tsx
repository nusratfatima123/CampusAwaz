'use client';

import { useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/cn';

interface FeedbackFormProps {
  trackingId: string;
  existingFeedback?: { rating: number; comment: string | null } | null;
  onSuccess: () => void;
}

export function FeedbackForm({
  trackingId,
  existingFeedback,
  onSuccess,
}: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (existingFeedback || submitted) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Feedback Submitted
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Thank you for your feedback. Your complaint has been resolved.
            </p>
          </div>
        </div>
        {existingFeedback && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < existingFeedback.rating
                      ? 'text-amber-500'
                      : 'text-slate-300'
                  }
                >
                  ★
                </span>
              ))}
            </div>
            {existingFeedback.comment && (
              <p className="mt-2 text-sm text-slate-600">
                {existingFeedback.comment}
              </p>
            )}
          </div>
        )}
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${trackingId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit feedback');

      setSubmitted(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <MessageSquare className="h-5 w-5 text-blue-900" aria-hidden="true" />
        How was your experience?
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Your complaint has been resolved. Please rate how satisfied you are with
        the resolution.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className={cn(
                  'rounded p-1 transition',
                  (hoverRating || rating) >= star
                    ? 'text-amber-500'
                    : 'text-slate-300',
                )}
                aria-label={`Rate ${star} out of 5`}
              >
                <Star className="h-7 w-7" fill="currentColor" />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm font-medium text-slate-700">
                {rating}/5
              </span>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="feedback-comment"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Comment (optional)
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell us more about your experience..."
          />
          <p className="mt-1 text-xs text-slate-500">
            {comment.length}/2000 characters
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button
          type="submit"
          disabled={rating === 0 || submitting}
          loading={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </form>
    </Card>
  );
}
