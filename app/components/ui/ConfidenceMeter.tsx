import { cn } from '@/lib/cn';
import { AI_LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants';

/**
 * Confidence indicator shared by the student assistant and the admin intake UI.
 *
 * Purely presentational — a low score never blocks anything, it only nudges the
 * human reviewer to look closer.
 */

export function confidencePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(Math.max(value, 0), 1) * 100);
}

export function confidenceLabel(value: number): string {
  if (value >= 0.85) return 'High confidence';
  if (value >= AI_LOW_CONFIDENCE_THRESHOLD) return 'Moderate confidence';
  return 'Low confidence — please review';
}

function barColor(value: number): string {
  if (value >= 0.85) return 'bg-green-600';
  if (value >= AI_LOW_CONFIDENCE_THRESHOLD) return 'bg-blue-700';
  return 'bg-amber-500';
}

export function ConfidenceMeter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  const percent = confidencePercent(value);

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-600">{label}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
          {percent}%
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-label={`${label} confidence`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor(value))}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
