import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface OcrFields {
  name: string | null;
  roll_id: string | null;
  university: string | null;
  validity: string | null;
  confidence: number;
}

/** Confidence badge tone: green ≥ threshold, amber below, red when unreadable. */
function confidenceTone(confidence: number, threshold: number) {
  if (confidence <= 0) return 'danger' as const;
  return confidence >= threshold ? ('success' as const) : ('warning' as const);
}

const FIELD_LABELS: { key: keyof Omit<OcrFields, 'confidence'>; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'roll_id', label: 'Roll / Student ID' },
  { key: 'university', label: 'University' },
  { key: 'validity', label: 'Valid until' },
];

/**
 * Displays the fields extracted from a student card, each with a confidence
 * indicator, plus a manual-review notice when confidence is low.
 */
export function OcrPreview({
  fields,
  threshold,
  needsManualReview,
  previewUrl,
  fileName,
  isPdf,
}: {
  fields: OcrFields;
  threshold: number;
  needsManualReview: boolean;
  previewUrl?: string | null;
  fileName?: string;
  isPdf?: boolean;
}) {
  const percent = Math.round(fields.confidence * 100);

  return (
    <div className="space-y-6">
      {/* Overall confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gray-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Overall confidence
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {percent}%
          </p>
        </div>

        {needsManualReview ? (
          <Badge tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Needs Manual Review
          </Badge>
        ) : (
          <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            High confidence
          </Badge>
        )}
      </div>

      {needsManualReview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm leading-relaxed text-amber-900">
            Some details were hard to read (below the{' '}
            {Math.round(threshold * 100)}% threshold). Your verification still goes
            through — an administrator will confirm the document later.
          </p>
        </div>
      ) : null}

      {/* File preview */}
      {previewUrl ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Uploaded document
          </p>
          {isPdf ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-900 hover:underline"
              >
                Open {fileName ?? 'uploaded PDF'}
              </a>
              <p className="mt-1 text-xs text-slate-500">
                Opens in a new tab using a short-lived secure link.
              </p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not a static asset */
            <img
              src={previewUrl}
              alt={`Uploaded student card${fileName ? `: ${fileName}` : ''}`}
              className="max-h-64 w-full rounded-xl border border-slate-200 bg-white object-contain p-2"
            />
          )}
        </div>
      ) : null}

      {/* Extracted fields */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Extracted details
        </p>
        <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {FIELD_LABELS.map(({ key, label }) => {
            const value = fields[key];
            const readable = Boolean(value);

            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 bg-white p-4"
              >
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {value ?? 'Not detected'}
                  </span>
                  <Badge
                    tone={
                      readable
                        ? confidenceTone(fields.confidence, threshold)
                        : 'danger'
                    }
                  >
                    {readable ? `${percent}%` : 'Unreadable'}
                  </Badge>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
