import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { ComplaintDetail } from '@/components/admin/ComplaintDetail';
import { getAuthContext } from '@/lib/auth';
import { canUseIntake, getAssignableStaff } from '@/lib/routing';
import { getComplaintDetail } from '@/lib/complaint-management';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EVIDENCE_BUCKET,
  EVIDENCE_SIGNED_URL_TTL_SECONDS,
  RESOLUTION_EVIDENCE_BUCKET,
  RESOLUTION_EVIDENCE_SIGNED_URL_TTL_SECONDS,
} from '@/lib/constants';

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

  const admin = createAdminClient();

  const signedEvidence = await Promise.all(
    detail.evidence.map(async (item) => {
      const { data } = await admin.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(item.storage_path, EVIDENCE_SIGNED_URL_TTL_SECONDS);
      return {
        id: item.id,
        fileName: item.file_name,
        fileType: item.file_type,
        fileSizeBytes: item.file_size_bytes,
        createdAt: item.created_at,
        url: data?.signedUrl ?? null,
      };
    }),
  );

  const signedResolutionEvidence = await Promise.all(
    detail.resolutionEvidence.map(async (item) => {
      const { data } = await admin.storage
        .from(RESOLUTION_EVIDENCE_BUCKET)
        .createSignedUrl(item.storage_path, RESOLUTION_EVIDENCE_SIGNED_URL_TTL_SECONDS);
      return {
        id: item.id,
        file_name: item.file_name,
        file_type: item.file_type,
        url: data?.signedUrl ?? null,
        created_at: item.created_at,
      };
    }),
  );

  const staff = profile?.university_id
    ? await getAssignableStaff(profile.university_id)
    : [];

  return (
    <div className="container-page py-10 md:py-14">
      <ComplaintDetail
        detail={{
          complaint: detail.complaint,
          history: detail.history,
          assignments: detail.assignments,
          escalations: detail.escalations,
          proofOfAction: detail.proofOfAction,
          resolutionEvidence: signedResolutionEvidence,
          feedback: detail.feedback,
          evidence: signedEvidence,
          identityVisible: detail.identityVisible,
          evidenceVisible: detail.evidenceVisible,
          studentName: detail.studentName,
          studentAlias: detail.studentAlias,
          canTakeAction: detail.canTakeAction,
          isAdmin: roles.includes('admin'),
          viewerId: user.id,
          slaDisplay: detail.slaDisplay,
          identityRequests: detail.identityRequests,
        }}
        staff={staff}
      />
    </div>
  );
}
