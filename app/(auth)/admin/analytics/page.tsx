import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { canUseIntake } from '@/lib/routing';
import { getAnalyticsSummary } from '@/lib/analytics';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Privacy-safe analytics for your university complaint system.',
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!canUseIntake(roles)) redirect('/dashboard');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analytics
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

  const summary = await getAnalyticsSummary(profile.university_id);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <BarChart3 className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Analytics
        </h1>
        <p className="mt-2 text-base text-slate-600">
          {profile.universities?.name ?? 'Your university'} — Privacy-safe complaint
          analytics. No student identity is exposed.
        </p>
      </div>

      <AnalyticsDashboard data={summary} />
    </div>
  );
}
