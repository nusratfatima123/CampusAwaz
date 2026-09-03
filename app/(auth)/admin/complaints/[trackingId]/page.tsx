import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { ComplaintDetail } from '@/components/admin/ComplaintDetail';
import { getAuthContext } from '@/lib/auth';
import { canUseIntake } from '@/lib/routing';
import { getComplaintDetail } from '@/lib/complaint-management';

export const metadata: Metadata = {
  title: 'Complaint Detail',
  description: 'View and manage a specific complaint.',
};

export const dynamic = 'force-dynamic';

/**
 * Admin complaint detail page with privacy-aware identity, timeline, and actions.
 */
export default async function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const { trackingId } = await params;
  const { user, profile, roles } = await getAuthContext();

  if (!user) redirect('/login');
  if (!canUseIntake(roles)) redirect('/dashboard');

  const detail = await getComplaintDetail(trackingId, user.id, roles);

  if (!detail) {
    return (
      <div className="container-page py-10 md:py-14">
        <Card>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Complaint not found
          </h1>
          <Alert tone="warning" className="mt-6">
            This complaint does not exist or you do not have permission to view it.
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
      <ComplaintDetail
        detail={{
          complaint: detail.complaint,
          history: detail.history,
          assignments: detail.assignments,
          escalations: detail.escalations,
          proofOfAction: detail.proofOfAction,
          resolutionEvidence: detail.resolutionEvidence,
          feedback: detail.feedback,
          identityVisible: detail.identityVisible,
          studentName: detail.studentName,
          studentAlias: detail.studentAlias,
        }}
      />
    </div>
  );
}
