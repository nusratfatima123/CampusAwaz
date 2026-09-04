import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { STATUS_PRESENTATION, type VerificationProgress } from '@/lib/verification';
import type { AffiliationStatus } from '@/types/database';
import { cn } from '@/lib/cn';

const TONE_TO_BADGE: Record<
  ReturnType<() => (typeof STATUS_PRESENTATION)[AffiliationStatus]['tone']>,
  BadgeTone
> = {
  neutral: 'neutral',
  info: 'info',
  warning: 'warning',
  success: 'success',
  danger: 'danger',
};

const STATUS_ICON: Record<AffiliationStatus, typeof ShieldCheck> = {
  unverified: Circle,
  pending_email: Clock3,
  pending_card: Clock3,
  verified: CheckCircle2,
  rejected: XCircle,
};

const ICON_STYLES: Record<AffiliationStatus, string> = {
  unverified: 'bg-slate-100 text-slate-500',
  pending_email: 'bg-blue-50 text-blue-900',
  pending_card: 'bg-amber-50 text-amber-600',
  verified: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600',
};

/**
 * Prominent status card for the verification hub: current state, the checklist
 * of methods, and the next action.
 */
export function VerificationStatusCard({
  status,
  progress,
  rejectionReason,
  needsManualReview,
}: {
  status: AffiliationStatus;
  progress: VerificationProgress;
  rejectionReason?: string | null;
  needsManualReview?: boolean;
}) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = STATUS_ICON[status];
  const verified = status === 'verified';
  const rejected = status === 'rejected';

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              ICON_STYLES[status]
            )}
            aria-hidden="true"
          >
            <Icon className="h-7 w-7" />
          </span>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {verified ? "You're all set" : 'Verification status'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              {presentation.description}
            </p>
          </div>
        </div>

        <Badge tone={TONE_TO_BADGE[presentation.tone]}>{presentation.label}</Badge>
      </div>

      {/* Rejection detail */}
      {rejected ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Reason</p>
          <p className="mt-1 text-sm text-red-800">
            {rejectionReason?.trim()
              ? rejectionReason
              : 'An administrator could not confirm your university affiliation.'}
          </p>
        </div>
      ) : null}

      {needsManualReview && verified ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            One document is queued for manual review. You keep full access in the
            meantime.
          </p>
        </div>
      ) : null}

      {/* Method checklist */}
      <ul className="mt-8 space-y-3" aria-label="Verification methods">
        {progress.steps.map((step) => (
          <li
            key={step.slug}
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-gray-50 p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              {step.complete ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-300"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {step.title}
                  {step.optional ? (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      Optional
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </div>
            </div>

            {!step.complete ? (
              <Link
                href={step.href}
                className="shrink-0 rounded-lg text-xs font-semibold text-blue-900 hover:underline"
              >
                {step.optional ? 'Add' : 'Start'}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Primary action */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {verified ? (
          <ButtonLink href="/dashboard" size="lg">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        ) : rejected ? (
          <ButtonLink href="/verify/university" size="lg">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Re-apply
          </ButtonLink>
        ) : progress.nextStep ? (
          <ButtonLink href={progress.nextStep.href} size="lg">
            {progress.nextStep.title}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        ) : null}

        {!verified && !rejected && !progress.cardVerified ? (
          <ButtonLink href="/verify/card" variant="secondary" size="lg">
            Upload student card instead
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}
