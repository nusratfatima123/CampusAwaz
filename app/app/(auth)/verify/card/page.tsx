import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifyStepShell } from '@/components/verification/VerifyStepShell';
import { CardUploader } from '@/components/verification/CardUploader';
import { Alert } from '@/components/ui/Alert';
import { getAuthContext } from '@/lib/auth';
import { getVerificationProgress } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Upload your student card',
  description:
    'Optionally add your student card for an extra layer of proof on your CampusAwaz account.',
};

export default async function VerifyCardPage() {
  const { user, profile, verifications } = await getAuthContext();
  if (!user) redirect('/login');

  const progress = getVerificationProgress({ profile, verifications });

  return (
    <VerifyStepShell
      title="Upload your student card"
      description="This step is optional. Adding your card gives your reports extra weight and helps us resolve edge cases if your email domain changes."
    >
      <div className="mb-6 space-y-4">
        <Alert tone="info" title="Optional step">
          Your card is stored in a private bucket that only you and university
          administrators can access. It is never shown publicly and is not
          attached to any report.
        </Alert>

        {progress.cardVerified ? (
          <Alert tone="success" title="Card already on file">
            You have already uploaded a student card. Uploading a new one replaces
            the details we hold.
          </Alert>
        ) : null}
      </div>

      <CardUploader />
    </VerifyStepShell>
  );
}
