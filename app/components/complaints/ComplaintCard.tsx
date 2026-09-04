import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { HoverCard } from '@/components/ui/Card';
import {
  PRIVACY_PRESENTATION,
  formatComplaintDate,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import type { ComplaintWithCategory } from '@/types/database';

/** One complaint tile on the student dashboard. */
export function ComplaintCard({ complaint }: { complaint: ComplaintWithCategory }) {
  const privacy = PRIVACY_PRESENTATION[complaint.privacy_mode];

  return (
    <Link
      href={`/complaints/${encodeURIComponent(complaint.tracking_id)}`}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <HoverCard className="h-full p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs font-bold tracking-tight text-blue-900">
            {complaint.tracking_id}
          </span>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-slate-300"
            aria-hidden="true"
          />
        </div>

        <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-slate-900">
          {complaint.title}
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(complaint.status)}>
            {statusLabel(complaint.status)}
          </Badge>
          <Badge tone={privacy.tone}>{privacy.label}</Badge>
          {complaint.is_sensitive ? (
            <Badge tone="danger" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
              Protected
            </Badge>
          ) : null}
          {complaint.immediate_danger ? (
            <Badge tone="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
              Immediate danger
            </Badge>
          ) : null}
        </div>

        <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Category</dt>
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>{complaint.complaint_categories?.label ?? 'Uncategorised'}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Submitted</dt>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <dd>{formatComplaintDate(complaint.submitted_at)}</dd>
          </div>
        </dl>
      </HoverCard>
    </Link>
  );
}

/** Loading skeleton matching the tile footprint. */
export function ComplaintCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
    >
      <div className="h-3 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-4 w-full rounded bg-slate-200" />
      <div className="mt-2 h-4 w-3/5 rounded bg-slate-200" />
      <div className="mt-5 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-slate-100" />
        <div className="h-6 w-20 rounded-full bg-slate-100" />
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="h-3 w-40 rounded bg-slate-100" />
      </div>
    </div>
  );
}
