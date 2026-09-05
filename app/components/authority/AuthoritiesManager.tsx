'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import {
  AuthorityRequestTable,
  type AdminRequestRow,
} from '@/components/authority/AuthorityRequestTable';
import {
  AuthorityReviewPanel,
  type ReviewRequestData,
} from '@/components/authority/AuthorityReviewPanel';
import {
  SuspensionDialog,
} from '@/components/authority/SuspensionDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { roleLabel } from '@/lib/roles';
import type { AuthorityRequestStatus, RoleName } from '@/types/database';

interface EnrichedRequest extends AdminRequestRow {
  review_reason: string | null;
  evidence_path: string | null;
  suspension_reason: string | null;
}

export function AuthoritiesManager() {
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AuthorityRequestStatus | 'all'>('all');
  const [suspendTarget, setSuspendTarget] = useState<EnrichedRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/authority/admin/requests?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRequests(json.requests ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  const reviewData: ReviewRequestData | null = selectedRequest
    ? {
        id: selectedRequest.id,
        user_id: selectedRequest.user_id,
        role_id: selectedRequest.role_id,
        status: selectedRequest.status,
        statement: selectedRequest.statement,
        evidence_path: selectedRequest.evidence_path,
        created_at: selectedRequest.created_at,
        reviewed_at: selectedRequest.reviewed_at,
        review_reason: selectedRequest.review_reason,
        role_name: selectedRequest.role_name,
        user_name: selectedRequest.user_name,
        user_phone: selectedRequest.user_phone,
      }
    : null;

  async function handleSuspendConfirm(reason: string) {
    if (!suspendTarget) return;

    const res = await fetch('/api/authority/admin/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: suspendTarget.user_id,
        roleId: suspendTarget.role_id,
        reason,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? 'Failed to suspend.');
    }

    setSuspendTarget(null);
    await fetchRequests();
  }

  const approvedRequests = requests.filter(
    (r) => r.status === 'approved' || r.status === 'reinstated'
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Pending & Reviewed Requests
        </h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">Loading requests...</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <AuthorityRequestTable
                requests={requests}
                selectedId={selectedId}
                onSelect={setSelectedId}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
            </div>
            <div className="lg:col-span-2">
              {reviewData ? (
                <AuthorityReviewPanel
                  request={reviewData}
                  onClose={() => setSelectedId(null)}
                  onAction={() => {
                    setSelectedId(null);
                    fetchRequests();
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-sm text-slate-500">
                    Select a request to view details and take action.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {approvedRequests.length > 0 ? (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Users className="h-5 w-5 text-blue-900" aria-hidden="true" />
            Active Authorities
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {req.user_name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone="neutral">
                        {req.role_name ? roleLabel(req.role_name) : 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={req.status === 'approved' ? 'success' : 'info'}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSuspendTarget(req)}
                      >
                        Suspend
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {suspendTarget ? (
        <SuspensionDialog
          userName={suspendTarget.user_name ?? 'Unknown user'}
          roleName={
            suspendTarget.role_name
              ? roleLabel(suspendTarget.role_name)
              : 'Unknown role'
          }
          onConfirm={handleSuspendConfirm}
          onClose={() => setSuspendTarget(null)}
        />
      ) : null}
    </div>
  );
}
