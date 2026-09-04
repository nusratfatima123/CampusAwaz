import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AuthorityRequestForm } from '@/components/authority/AuthorityRequestForm';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { isStaff } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Request Authority',
  description: 'Request an authority role at your university.',
};

export const dynamic = 'force-dynamic';

export default async function AuthorityRequestPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile) && !isStaff(roles)) redirect('/pending');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <div className="mx-auto max-w-2xl">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            <ShieldCheck className="h-6 w-6 text-blue-900" aria-hidden="true" />
            Request Authority
          </h1>
          <p className="mt-4 text-base text-slate-600">
            You need to be associated with a university to request an authority
            role.
          </p>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: departments } = await admin
    .from('departments')
    .select('id, name')
    .eq('university_id', profile.university_id)
    .eq('is_active', true)
    .order('name');

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <ShieldCheck className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Request Authority
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Apply for an authority role at{' '}
          {profile.universities?.name ?? 'your university'}. Your request will be
          reviewed by an administrator.
        </p>

        <div className="mt-8">
          <AuthorityRequestForm
            departments={
              (departments ?? []).map((d) => ({ id: d.id, name: d.name }))
            }
          />
        </div>
      </div>
    </div>
  );
}
