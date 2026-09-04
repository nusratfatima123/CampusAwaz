import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Building2,
  GraduationCap,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getAuthContext, displayName } from '@/lib/auth';
import { STATUS_PRESENTATION } from '@/lib/verification';
import { primaryRole, roleLabel } from '@/lib/roles';
import { getAuthorityRequests } from '@/lib/authority';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuthorityRequestStatus } from '@/types/database';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Review the details CampusAwaz holds about your account.',
};

export default async function ProfilePage() {
  const { user, profile, roles } = await getAuthContext();
  if (!user) redirect('/login');

  const status = profile?.affiliation_status ?? 'unverified';
  const presentation = STATUS_PRESENTATION[status];
  const role = primaryRole(roles);

  const rows: { label: string; value: string; Icon: typeof UserRound }[] = [
    { label: 'Full name', value: displayName(profile, user), Icon: UserRound },
    { label: 'Account email', value: user.email ?? 'Not available', Icon: Mail },
    {
      label: 'University',
      value: profile?.universities
        ? `${profile.universities.name} (${profile.universities.code})`
        : 'Not selected',
      Icon: Building2,
    },
    {
      label: 'Student status',
      value:
        profile?.student_type === 'graduate'
          ? 'Graduate / Alumni'
          : profile?.student_type === 'current_student'
            ? 'Current Student'
            : 'Not specified',
      Icon: GraduationCap,
    },
    {
      label: 'Role',
      value: roleLabel(role),
      Icon: ShieldCheck,
    },
  ];

  const STATUS_TONE: Record<AuthorityRequestStatus, 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    suspended: 'danger',
    reinstated: 'info',
  };

  let authorityRequests: { id: string; status: AuthorityRequestStatus; role_name: string; created_at: string }[] = [];
  if (user) {
    const [requests] = await Promise.all([
      getAuthorityRequests({ userId: user.id }),
    ]);
    if (requests.length > 0) {
      const admin = createAdminClient();
      const roleIds = [...new Set(requests.map((r) => r.role_id))];
      const { data: roleRows } = await admin
        .from('roles')
        .select('id, name')
        .in('id', roleIds);
      const roleMap = new Map((roleRows ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
      authorityRequests = requests.map((r) => ({
        id: r.id,
        status: r.status,
        role_name: roleLabel((roleMap.get(r.role_id) ?? 'student') as any),
        created_at: r.created_at,
      }));
    }
  }

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Your profile
        </h1>
        <p className="mt-3 text-base text-slate-600">
          These are the only details CampusAwaz stores about you. Editing profile
          details arrives with the complaint system in Sprint 2.
        </p>

        <Card className="mt-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">
              Verification
            </span>
            <Badge tone={presentation.tone}>{presentation.label}</Badge>
          </div>

          <dl className="divide-y divide-slate-100">
            {rows.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <dt className="flex w-48 shrink-0 items-center gap-2 text-sm font-medium text-slate-500">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </dt>
                <dd className="min-w-0 break-words text-sm font-semibold text-slate-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {status !== 'verified' ? (
            <Link
              href="/verify"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Continue verification
            </Link>
          ) : null}
        </Card>

        {user && (
          <Card className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Authority requests
              </h2>
              {status === 'verified' && (
                <Link
                  href="/authority/request"
                  className="text-sm font-medium text-blue-900 hover:underline"
                >
                  Request authority
                </Link>
              )}
            </div>

            {authorityRequests.length === 0 ? (
              <p className="text-sm text-slate-500">
                {status === 'verified'
                  ? 'You have not requested any authority roles yet.'
                  : 'Verify your account to request authority roles.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {authorityRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {req.role_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[req.status]}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {authorityRequests.length > 0 && (
              <Link
                href="/authority/status"
                className="mt-4 inline-block text-sm font-medium text-blue-900 hover:underline"
              >
                View details
              </Link>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
