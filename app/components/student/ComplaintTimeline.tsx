'use client';

import { Check, Clock } from 'lucide-react';
import {
  COMPLAINT_STATUS_PRESENTATION,
  formatComplaintDateTime,
  statusLabel,
} from '@/lib/complaint-ui';
import { cn } from '@/lib/cn';
import type { ComplaintStatus, ComplaintStatusHistory } from '@/types/database';

/**
 * Chronological status timeline for the student view.
 */
export function ComplaintTimeline({
  history,
}: {
  history: Pick<ComplaintStatusHistory, 'status' | 'notes' | 'created_at'>[];
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No timeline entries yet. Updates will appear here as your case progresses.
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
          <li key={`${entry.status}-${entry.created_at}`} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                'absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                latest ? 'bg-blue-900 text-white' : 'bg-green-600 text-white',
              )}
            >
              {latest ? (
                <Clock className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
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
