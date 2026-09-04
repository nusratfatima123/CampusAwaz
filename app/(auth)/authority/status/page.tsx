import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { AuthorityStatusCard } from '@/components/authority/AuthorityStatusCard';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { isStaff } from '@/lib/roles';
import { getAuthorityRequests } from '@/lib/authority';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RoleName } from '@/types/database';

export const metadata: Metadata = {
  title: 'My Authority Requests',
  description: 'View the status of your authority role requests.',
};

export const dynamic = 'force-dynamic';

export default async function AuthorityStatusPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile) && !isStaff(roles)) redirect('/pending');

  const requests = await getAuthorityRequests({ userId: user.id });

  const admin = createAdminClient();
  const { data: roleRows } = await admin.from('roles').select('id, name');
  const roleMap = new Map((roleRows ?? []).map((r) => [r.id, r.name as RoleName]));

  const enriched = requests.map((r) => ({
    id: r.id,
    role_id: r.role_id,
    status: r.status,
    statement: r.statement,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at,
    review_reason: r.review_reason,
    suspension_reason: r.suspension_reason,
    role_name: roleMap.get(r.role_id) ?? null,
  }));

  const hasActive = enriched.some(
    (r) => r.status === 'approved' || r.status === 'reinstated'
  );

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              <ShieldCheck className="h-6 w-6 text-blue-900" aria-hidden="true" />
              My Authority Requests
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Track the status of your authority role requests.
            </p>
          </div>
          {!hasActive ? (
            <ButtonLink href="/authority/request" variant="primary" size="sm">
              New Request
            </ButtonLink>
          ) : null}
        </div>

        {enriched.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ShieldCheck
              className="mx-auto h-10 w-10 text-slate-300"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-base font-bold text-slate-900">
              No requests yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              You haven&apos;t submitted any authority role requests.
            </p>
            <Link
              href="/authority/request"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Request Authority
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {enriched.map((req) => (
              <AuthorityStatusCard key={req.id} request={req} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
