'use client';

import { Inbox, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { confidencePercent } from '@/components/ui/ConfidenceMeter';
import {
  PRIORITY_PRESENTATION,
  formatComplaintDate,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import { AI_LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { IntakeItem } from '@/lib/routing';

export interface IntakeTableProps {
  items: IntakeItem[];
  selectedTrackingId: string | null;
  onSelect: (trackingId: string) => void;
}

/**
 * Queue of complaints awaiting a routing decision.
 *
 * A table on desktop, stacked cards on small screens. Reporter identity is only
 * ever rendered from `reporterName`, which the server leaves null unless the
 * privacy mode exposes it to this staff member.
 */
export function IntakeTable({
  items,
  selectedTrackingId,
  onSelect,
}: IntakeTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Inbox
          className="mx-auto h-10 w-10 text-slate-300"
          aria-hidden="true"
        />
        <h3 className="mt-4 text-base font-bold text-slate-900">
          Nothing waiting for review
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Every complaint at your university has been routed. New submissions will
          appear here as soon as they arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Desktop table */}
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">
          Complaints awaiting a routing decision
        </caption>
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Tracking ID
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Category
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              AI recommendation
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Confidence
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Submitted
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const selected = item.trackingId === selectedTrackingId;
            const recommendation = item.recommendation;
            const priority = recommendation
              ? PRIORITY_PRESENTATION[recommendation.priority]
              : PRIORITY_PRESENTATION[item.priority];

            return (
              <tr
                key={item.trackingId}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                onClick={() => onSelect(item.trackingId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.trackingId);
                  }
                }}
                className={cn(
                  'cursor-pointer align-top transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                  selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                )}
              >
                <td className="px-5 py-4">
                  <span className="font-mono text-xs font-semibold text-blue-900">
                    {item.trackingId}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {item.isSensitive ? (
                      <Badge tone="danger" icon={<Lock className="h-3 w-3" />}>
                        Protected
                      </Badge>
                    ) : null}
                    {item.immediateDanger ? (
                      <Badge
                        tone="danger"
                        icon={<ShieldAlert className="h-3 w-3" />}
                      >
                        Danger
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block max-w-[22ch] truncate text-xs text-slate-500">
                    {item.reporterName ?? item.reporterAlias ?? 'Reporter hidden'}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <span className="block max-w-[20ch] truncate text-sm font-medium text-slate-900">
                    {item.categoryLabel ?? '—'}
                  </span>
                  <span className="mt-1 block max-w-[26ch] truncate text-xs text-slate-500">
                    {item.title}
                  </span>
                </td>

                <td className="px-5 py-4">
                  {recommendation ? (
                    <span className="space-y-1.5">
                      <span className="flex items-center gap-1.5 text-sm text-slate-900">
                        <Sparkles
                          className="h-3.5 w-3.5 shrink-0 text-blue-700"
                          aria-hidden="true"
                        />
                        <span className="max-w-[20ch] truncate">
                          {recommendation.categoryLabel ?? '—'}
                        </span>
                      </span>
                      <span className="block max-w-[22ch] truncate text-xs text-slate-500">
                        {recommendation.departmentName ??
                          recommendation.departmentKey ??
                          '—'}
                      </span>
                      <Badge tone={priority.tone}>{priority.label}</Badge>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Manual routing</span>
                  )}
                </td>

                <td className="px-5 py-4">
                  {recommendation ? (
                    <Badge
                      tone={
                        recommendation.overallConfidence <
                        AI_LOW_CONFIDENCE_THRESHOLD
                          ? 'warning'
                          : 'success'
                      }
                    >
                      {confidencePercent(recommendation.overallConfidence)}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>

                <td className="px-5 py-4">
                  <Badge tone={statusTone(item.status)}>
                    {statusLabel(item.status)}
                  </Badge>
                  {item.assignedToName ? (
                    <span className="mt-1 block max-w-[18ch] truncate text-xs text-slate-500">
                      {item.assignedToName}
                    </span>
                  ) : null}
                </td>

                <td className="px-5 py-4 text-xs text-slate-500">
                  {formatComplaintDate(item.submittedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {items.map((item) => {
          const selected = item.trackingId === selectedTrackingId;
          const recommendation = item.recommendation;
          const priority = recommendation
            ? PRIORITY_PRESENTATION[recommendation.priority]
            : PRIORITY_PRESENTATION[item.priority];

          return (
            <li key={item.trackingId}>
              <button
                type="button"
                onClick={() => onSelect(item.trackingId)}
                aria-pressed={selected}
                className={cn(
                  'w-full px-5 py-4 text-left transition',
                  selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-blue-900">
                    {item.trackingId}
                  </span>
                  <Badge tone={statusTone(item.status)}>
                    {statusLabel(item.status)}
                  </Badge>
                </span>

                <span className="mt-2 block truncate text-sm font-medium text-slate-900">
                  {item.title}
                </span>

                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{item.categoryLabel ?? '—'}</Badge>
                  <Badge tone={priority.tone}>{priority.label}</Badge>
                  {recommendation ? (
                    <Badge
                      tone={
                        recommendation.overallConfidence <
                        AI_LOW_CONFIDENCE_THRESHOLD
                          ? 'warning'
                          : 'success'
                      }
                      icon={<Sparkles className="h-3 w-3" />}
                    >
                      {confidencePercent(recommendation.overallConfidence)}%
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Manual</Badge>
                  )}
                  {item.isSensitive ? (
                    <Badge tone="danger" icon={<Lock className="h-3 w-3" />}>
                      Protected
                    </Badge>
                  ) : null}
                </span>

                <span className="mt-2 block text-xs text-slate-500">
                  {item.reporterName ?? item.reporterAlias ?? 'Reporter hidden'} ·{' '}
                  {formatComplaintDate(item.submittedAt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
