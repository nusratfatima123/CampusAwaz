import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stepper } from '@/components/ui/Stepper';
import { VerificationStatusCard } from '@/components/verification/VerificationStatusCard';
import { getAuthContext } from '@/lib/auth';
import { getVerificationProgress } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Verification',
  description: 'Track and complete your CampusAwaz university verification.',
};

export default async function VerifyHubPage() {
  const { user, profile, verifications } = await getAuthContext();

  if (!user) redirect('/login');

  const status = profile?.affiliation_status ?? 'unverified';
  const progress = getVerificationProgress({ profile, verifications });

  // Latest rejection note, if an admin recorded one.
  const rejection = verifications.find((v) => v.status === 'rejected');
  const needsManualReview = verifications.some(
    (v) => v.status === 'verified' && v.needs_manual_review
  );

  const stepperItems = [
    { label: 'University', complete: progress.steps[0]?.complete },
    { label: 'Status', complete: progress.steps[1]?.complete },
    { label: 'Email/OTP', complete: progress.steps[2]?.complete },
    { label: 'Card', complete: progress.steps[3]?.complete, optional: true },
    { label: 'Done', complete: status === 'verified' },
  ];

  // Highlight the first incomplete stage.
  const currentIndex = stepperItems.findIndex((item) => !item.complete);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <Stepper
            items={stepperItems}
            currentIndex={currentIndex === -1 ? stepperItems.length - 1 : currentIndex}
          />
        </div>

        <VerificationStatusCard
          status={status}
          progress={progress}
          rejectionReason={rejection?.reviewer_notes ?? null}
          needsManualReview={needsManualReview}
        />
      </div>
    </div>
  );
}
