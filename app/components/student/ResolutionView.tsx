'use client';

import { CheckCircle2, FileText, Paperclip } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatComplaintDateTime } from '@/lib/complaint-ui';

export interface ResolutionViewData {
  proofOfAction: {
    action_taken: string;
    resolution_explanation: string | null;
    created_at: string;
  } | null;
  resolutionEvidence: {
    id: string;
    fileName: string;
    fileType: string;
    url?: string;
  }[];
  feedback: {
    rating: number;
    comment: string | null;
  } | null;
}

interface ResolutionViewProps {
  resolution: ResolutionViewData;
}

export function ResolutionView({ resolution }: ResolutionViewProps) {
  const { proofOfAction, resolutionEvidence, feedback } = resolution;

  if (!proofOfAction) return null;

  return (
    <Card className="border-green-200 bg-green-50/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-bold text-green-900">
            Resolution Details
          </h3>
          <p className="mt-0.5 text-xs text-green-700">
            Resolved on {formatComplaintDateTime(proofOfAction.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-green-700" aria-hidden="true" />
            Action Taken
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {proofOfAction.action_taken}
          </p>
        </div>

        {proofOfAction.resolution_explanation && (
          <div>
            <h4 className="text-sm font-semibold text-slate-800">
              Explanation
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {proofOfAction.resolution_explanation}
            </p>
          </div>
        )}

        {resolutionEvidence.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Paperclip className="h-4 w-4 text-green-700" aria-hidden="true" />
              Evidence Files
              <span className="text-xs font-normal text-slate-500">
                ({resolutionEvidence.length})
              </span>
            </h4>
            <ul className="mt-2 space-y-1.5">
              {resolutionEvidence.map((file) => (
                <li key={file.id}>
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-900"
                    >
                      {file.fileName}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-600">
                      {file.fileName}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800">
              Your Feedback
            </h4>
            <div className="mt-2 flex items-center gap-1">
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
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feedback.comment}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
