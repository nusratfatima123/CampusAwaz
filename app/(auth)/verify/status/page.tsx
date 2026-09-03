import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifyStepShell } from '@/components/verification/VerifyStepShell';
import { StatusStep } from '@/components/verification/StatusStep';
import { getAuthContext } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Confirm your status',
  description:
    'Tell CampusAwaz whether you are a current student or a graduate of your university.',
};

export default async function VerifyStatusPage() {
  const { user, profile } = await getAuthContext();
  if (!user) redirect('/login');

  return (
    <VerifyStepShell
      title="Confirm your status"
      description="Are you currently enrolled, or have you already graduated? Both current students and alumni can use CampusAwaz."
    >
      <StatusStep initialStudentType={profile?.student_type ?? null} />
    </VerifyStepShell>
  );
}
