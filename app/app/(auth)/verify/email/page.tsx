import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { VerifyStepShell } from '@/components/verification/VerifyStepShell';
import { OtpForm } from '@/components/verification/OtpForm';
import { Alert } from '@/components/ui/Alert';
import { getAuthContext } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Verify your university email',
  description:
    'Confirm the 6-digit code sent to your official university email address.',
};

export default async function VerifyEmailPage() {
  const { user, profile } = await getAuthContext();
  if (!user) redirect('/login');

  const university = profile?.universities ?? null;
  const allowedDomains = university?.allowed_email_domains ?? [];

  // The university drives which email domains are acceptable, so it must be
  // chosen first.
  if (!profile?.university_id || !university) {
    return (
      <VerifyStepShell
        title="Verify your university email"
        description="We need to know your university before we can check your email address."
      >
        <Alert tone="info" title="Select your university first">
          Email domains are validated against your institution, so pick your
          university before requesting a code.
        </Alert>

        <Link
          href="/verify/university"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Select university
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </VerifyStepShell>
    );
  }

  return (
    <VerifyStepShell
      title="Verify your university email"
      description={`Enter an official ${university.name} email address. We will send a 6-digit code to confirm you own it.`}
    >
      <OtpForm allowedDomains={allowedDomains} initialEmail={user.email ?? null} />
    </VerifyStepShell>
  );
}
