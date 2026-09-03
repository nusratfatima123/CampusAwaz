'use client';

import { Sparkles, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import {
  ConfidenceMeter,
  confidenceLabel,
} from '@/components/ui/ConfidenceMeter';
import { PRIORITY_PRESENTATION } from '@/lib/complaint-ui';
import { AI_LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants';
import type { IntakeRecommendation } from '@/lib/routing';

export interface AiRecommendationCardProps {
  recommendation: IntakeRecommendation | null;
  /** Optional footnote, e.g. the reviewing student edited the values. */
  className?: string;
}

/**
 * Read-only summary of what the AI proposed for a complaint.
 *
 * The override controls live in `RoutingPanel` — this card never mutates
 * anything, it only reports the model's suggestion and its confidence so the
 * human reviewer can judge it.
 */
export function AiRecommendationCard({
  recommendation,
  className,
}: AiRecommendationCardProps) {
  if (!recommendation) {
    return (
      <Alert tone="info" title="No AI recommendation" className={className}>
        This complaint was filed without the AI assistant. Route it manually using
        the controls below.
      </Alert>
    );
  }

  const priority = PRIORITY_PRESENTATION[recommendation.priority];
  const lowConfidence =
    recommendation.overallConfidence < AI_LOW_CONFIDENCE_THRESHOLD;

  return (
    <div
      className={[
        'rounded-2xl border border-blue-200 bg-blue-50/60 p-5',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-blue-900">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          AI recommendation
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {recommendation.adminOverride ? (
            <Badge tone="purple" icon={<UserCheck className="h-3 w-3" />}>
              Reviewed by staff
            </Badge>
          ) : null}
          {recommendation.wasEdited ? (
            <Badge tone="neutral">Edited by reporter</Badge>
          ) : null}
          <Badge tone={lowConfidence ? 'warning' : 'success'}>
            {confidenceLabel(recommendation.overallConfidence)}
          </Badge>
        </div>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Category
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold text-slate-900">
            {recommendation.categoryLabel ?? '—'}
          </dd>
          {recommendation.subcategory ? (
            <dd className="mt-0.5 truncate text-xs text-slate-500">
              {recommendation.subcategory}
            </dd>
          ) : null}
          <dd className="mt-2">
            <ConfidenceMeter
              label="Category"
              value={recommendation.categoryConfidence}
            />
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Priority
          </dt>
          <dd className="mt-1">
            <Badge tone={priority.tone}>{priority.label}</Badge>
          </dd>
          <dd className="mt-2">
            <ConfidenceMeter
              label="Priority"
              value={recommendation.priorityConfidence}
            />
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Department
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold text-slate-900">
            {recommendation.departmentName ?? recommendation.departmentKey ?? '—'}
          </dd>
          <dd className="mt-2">
            <ConfidenceMeter
              label="Department"
              value={recommendation.departmentConfidence}
            />
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-blue-200 pt-3">
        <ConfidenceMeter
          label="Overall confidence"
          value={recommendation.overallConfidence}
        />
        {recommendation.modelUsed ? (
          <p className="mt-2 text-xs text-slate-500">
            Model: {recommendation.modelUsed}
          </p>
        ) : null}
      </div>

      {lowConfidence ? (
        <Alert tone="warning" className="mt-4">
          The assistant was unsure about this one. Confirm the category and
          department before assigning.
        </Alert>
      ) : null}
    </div>
  );
}
