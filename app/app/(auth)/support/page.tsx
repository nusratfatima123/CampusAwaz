import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { SupportHub } from '@/components/support/SupportHub';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getSupportResources, getEmergencyContacts, getCounselingRequestsForStudent } from '@/lib/support';
import { getPolicies } from '@/lib/faq';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Student support hub — resources, counseling, FAQs, and emergency contacts.',
};

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');

  if (!profile?.university_id) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Support
          </h1>
          <Alert tone="warning" title="No university linked" className="mt-6">
            Select your university to access support resources.
          </Alert>
          <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
            Back to dashboard
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const [resources, emergencyContacts, counselingRequests, policies] =
    await Promise.all([
      getSupportResources(profile.university_id),
      getEmergencyContacts(profile.university_id),
      getCounselingRequestsForStudent(user.id),
      getPolicies(profile.university_id),
    ]);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <Heart className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Student Support
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Resources, anonymous counseling, FAQs, and emergency contacts for{' '}
          {profile.universities?.name ?? 'your university'}.
        </p>
      </div>

      <SupportHub
        resources={resources}
        counselingRequests={counselingRequests}
        emergencyContacts={emergencyContacts}
        policies={policies}
      />
    </div>
  );
}
