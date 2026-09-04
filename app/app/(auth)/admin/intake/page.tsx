import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Inbox, ShieldCheck, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { IntakeWorkspace } from '@/components/admin/IntakeWorkspace';
import { getAuthContext } from '@/lib/auth';
import { roleLabel, primaryRole } from '@/lib/roles';
import { canUseIntake, getIntakeQueue } from '@/lib/routing';

export const metadata: Metadata = {
  title: 'Complaint intake',
  description:
    'Review AI recommendations and route incoming complaints to the right department.',
};

// The queue changes with every submission, so never serve it from the cache.
export const dynamic = 'force-dynamic';

/**
 * Admin smart-routing queue.
 *
 * Access is limited to the intake roles (admin, hod, proctor, female focal
 * person, hostel warden, counselor). Sensitive complaints are filtered inside
 * `getIntakeQueue` to the ones this staff member holds explicit access for.
 */
export default async function AdminIntakePage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');

  // Students and unauthorized staff never see this surface.
  if (!canUseIntake(roles)) redirect('/dashboard');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Complaint intake
          </h1>
          <Alert tone="warning" title="No university linked" className="mt-6">
            Your staff account is not linked to a university yet, so there is no
            intake queue to show. Ask an administrator to complete your profile.
          </Alert>
          <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
            Back to dashboard
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const queue = await getIntakeQueue(user.id, profile.university_id);

  return (
    <div className="container-page py-10 md:py-14">
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              <Inbox className="h-6 w-6 text-blue-900" aria-hidden="true" />
              Complaint intake
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
              Review each submission, confirm or correct what the assistant
              suggested, and assign it to the right officer. Recommendations are
              never applied automatically.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
              {roleLabel(primaryRole(roles))}
            </Badge>
            <Badge tone="info" icon={<Sparkles className="h-3.5 w-3.5" />}>
              Human review required
            </Badge>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {profile.universities?.name ?? 'Your university'} · complaints in
          &ldquo;Submitted&rdquo; or &ldquo;Assigned&rdquo;
        </p>
      </Card>

      <section className="mt-8">
        <IntakeWorkspace
          items={queue.items}
          departments={queue.departments.map((department) => ({
            id: department.id,
            key: department.key,
            name: department.name,
          }))}
          staff={queue.staff}
          categories={queue.categories.map((category) => ({
            id: category.id,
            key: category.key,
            label: category.label,
            is_sensitive: category.is_sensitive,
          }))}
        />
      </section>
    </div>
  );
}
