'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { AuthorityRequestStatus, RoleName } from '@/types/database';

export interface UserRequestData {
  id: string;
  role_id: string;
  status: AuthorityRequestStatus;
  statement: string;
  created_at: string;
  reviewed_at: string | null;
  review_reason: string | null;
  suspension_reason: string | null;
  role_name: RoleName | null;
}

const STATUS_TONES: Record<AuthorityRequestStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'neutral',
  reinstated: 'info',
};

const STATUS_MESSAGES: Record<AuthorityRequestStatus, string> = {
  pending: 'Your request is under review by an administrator.',
  approved: 'Your request has been approved. You now hold this authority role.',
  rejected: 'Your request was not approved. See the reason below.',
  suspended: 'Your authority has been suspended. You no longer have access to this role.',
  reinstated: 'Your authority has been reinstated. You have access to this role again.',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export interface AuthorityStatusCardProps {
  request: UserRequestData;
}

export function AuthorityStatusCard({ request }: AuthorityStatusCardProps) {
  return (
    <Card className="!p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {request.role_name ? roleLabel(request.role_name) : 'Authority Role'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Submitted {formatDate(request.created_at)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[request.status]}>
          {request.status.replace('_', ' ')}
        </Badge>
      </div>

      <p className={cn(
        'mt-3 text-sm leading-relaxed',
        request.status === 'approved' || request.status === 'reinstated'
          ? 'text-green-700'
          : request.status === 'rejected' || request.status === 'suspended'
            ? 'text-red-600'
            : 'text-slate-600'
      )}>
        {STATUS_MESSAGES[request.status]}
      </p>

      {request.review_reason && (request.status === 'rejected') ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700">Reason</p>
          <p className="mt-1 text-sm text-red-600">{request.review_reason}</p>
        </div>
      ) : null}

      {request.suspension_reason ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Suspension reason</p>
          <p className="mt-1 text-sm text-slate-600">{request.suspension_reason}</p>
        </div>
      ) : null}

      {request.reviewed_at ? (
        <p className="mt-3 text-xs text-slate-400">
          Reviewed on {formatDate(request.reviewed_at)}
        </p>
      ) : null}
    </Card>
  );
}
