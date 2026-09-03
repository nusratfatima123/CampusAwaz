import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { canUseIntake, getDepartments } from '@/lib/routing';
import { getComplaintList, getDashboardSummary } from '@/lib/complaint-management';
import type { DashboardSummary, ComplaintListItem } from '@/components/admin/AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage and track complaints across your university.',
};

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard with summary cards and complaint list.
 * Access restricted to staff with intake roles.
 */
export default async function AdminDashboardPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!canUseIntake(roles)) redirect('/dashboard');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Admin Dashboard
          </h1>
          <Alert tone="warning" title="No university linked" className="mt-6">
            Your staff account is not linked to a university yet.
          </Alert>
          <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
            Back to dashboard
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const [summary, listResult] = await Promise.all([
    getDashboardSummary(profile.university_id, user.id, roles),
    getComplaintList({
      universityId: profile.university_id,
      userId: user.id,
      roles,
      limit: 50,
      offset: 0,
    }),
  ]);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <LayoutDashboard className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Admin Dashboard
        </h1>
        <p className="mt-2 text-base text-slate-600">
          {profile.universities?.name ?? 'Your university'} — Overview of all complaints
        </p>
      </div>

      <AdminDashboard
        initialSummary={summary}
        initialItems={listResult.items}
        initialTotal={listResult.total}
      />
    </div>
  );
}
