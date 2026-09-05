'use client';

import { Inbox, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { AuthorityRequestStatus, RoleName } from '@/types/database';

export interface AdminRequestRow {
  id: string;
  user_id: string;
  role_id: string;
  status: AuthorityRequestStatus;
  statement: string;
  created_at: string;
  reviewed_at: string | null;
  role_name: RoleName | null;
  user_name: string | null;
  user_phone: string | null;
}

const STATUS_TONES: Record<AuthorityRequestStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'neutral',
  reinstated: 'info',
};

const STATUS_LABELS: Record<AuthorityRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  reinstated: 'Reinstated',
};

export interface AuthorityRequestTableProps {
  requests: AdminRequestRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter: AuthorityRequestStatus | 'all';
  onStatusFilterChange: (status: AuthorityRequestStatus | 'all') => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AuthorityRequestTable({
  requests,
  selectedId,
  onSelect,
  statusFilter,
  onStatusFilterChange,
}: AuthorityRequestTableProps) {
  const statuses: (AuthorityRequestStatus | 'all')[] = [
    'all',
    'pending',
    'approved',
    'rejected',
    'suspended',
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatusFilterChange(s)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition',
              statusFilter === s
                ? 'bg-blue-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No requests found
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            {statusFilter === 'all'
              ? 'No authority requests have been submitted yet.'
              : `No requests with status "${STATUS_LABELS[statusFilter as AuthorityRequestStatus]}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">Authority requests</caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Requester
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Submitted
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Reviewed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => {
                const selected = req.id === selectedId;
                return (
                  <tr
                    key={req.id}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(req.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(req.id);
                      }
                    }}
                    className={cn(
                      'cursor-pointer align-top transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <UserIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {req.user_name ?? 'Unknown user'}
                      </span>
                      {req.user_phone ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {req.user_phone}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone="neutral">
                        {req.role_name ? roleLabel(req.role_name) : 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={STATUS_TONES[req.status]}>
                        {STATUS_LABELS[req.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {req.reviewed_at ? formatDate(req.reviewed_at) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="divide-y divide-slate-100 md:hidden">
            {requests.map((req) => {
              const selected = req.id === selectedId;
              return (
                <li key={req.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(req.id)}
                    aria-pressed={selected}
                    className={cn(
                      'w-full px-5 py-4 text-left transition',
                      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <UserIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {req.user_name ?? 'Unknown user'}
                      </span>
                      <Badge tone={STATUS_TONES[req.status]}>
                        {STATUS_LABELS[req.status]}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {req.role_name ? roleLabel(req.role_name) : 'Unknown role'}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatDate(req.created_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
