import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { AuthoritiesManager } from '@/components/authority/AuthoritiesManager';
import { getAuthContext } from '@/lib/auth';
import { canUseIntake } from '@/lib/routing';

export const metadata: Metadata = {
  title: 'Manage Authorities',
  description: 'Review authority requests and manage university authorities.',
};

export const dynamic = 'force-dynamic';

export default async function AdminAuthoritiesPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!canUseIntake(roles)) redirect('/dashboard');
  if (!roles.includes('admin')) redirect('/admin/dashboard');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Manage Authorities
          </h1>
          <Alert tone="warning" title="No university linked" className="mt-6">
            Your admin account is not linked to a university yet.
          </Alert>
          <ButtonLink href="/admin/dashboard" variant="secondary" className="mt-6">
            Back to dashboard
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <ShieldCheck className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Manage Authorities
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Review authority role requests and manage active authorities at{' '}
          {profile.universities?.name ?? 'your university'}.
        </p>
      </div>

      <AuthoritiesManager />
    </div>
  );
}
