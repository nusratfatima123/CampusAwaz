import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  History,
  Paperclip,
  ShieldAlert,
  Tag,
  UserCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { StatusTimeline } from '@/components/complaints/StatusTimeline';
import { EvidenceGallery } from '@/components/complaints/EvidenceGallery';
import { ResolutionView } from '@/components/student/ResolutionView';
import { FeedbackForm } from '@/components/student/FeedbackForm';
import { IdentityPermissionCard } from '@/components/student/IdentityPermissionCard';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getComplaintByTrackingId, getEvidenceSignedUrls } from '@/lib/complaints';
import { getResolutionEvidenceSignedUrls } from '@/lib/resolution';
import { getFeedbackByTrackingId } from '@/lib/feedback';
import { getIdentityRequestsForComplaint } from '@/lib/identity-access';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PRIVACY_PRESENTATION,
  PRIORITY_PRESENTATION,
  formatComplaintDateTime,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import { isTrackingIdShape } from '@/lib/validators';

export const metadata: Metadata = {
  title: 'Complaint detail',
  description: 'Follow the progress of a complaint you filed.',
};

/**
 * Complaint detail, scoped to the reporting student.
 * Staff-facing case views arrive with the admin dashboards in a later sprint.
 */
export default async function ComplaintDetailPage({
  params,
}: {
  params: { trackingId: string };
}) {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!profile?.university_id) {
    redirect('/verify/university');
  }

  const trackingId = decodeURIComponent(params.trackingId ?? '');
  if (!isTrackingIdShape(trackingId)) notFound();

  const detail = await getComplaintByTrackingId(trackingId, user.id);
  if (!detail) notFound();

  const { complaint, history, privacy } = detail;
  const evidence = (await getEvidenceSignedUrls(trackingId, user.id)) ?? [];

  const identityRequests = await getIdentityRequestsForComplaint(
    (complaint as { id: string }).id,
  );
  const actionableRequests = identityRequests.filter(
    (r) => r.status === 'pending' || r.status === 'admin_approved',
  );
  const decidedRequests = identityRequests.filter(
    (r) => r.status === 'granted' || r.status === 'denied',
  );

  // Sprint 5: fetch resolution data when complaint is resolved.
  let proofOfAction = null;
  let resolutionEvidence: { id: string; fileName: string; fileType: string; url?: string }[] = [];
  let feedback = null;

  if (complaint.status === 'resolved' || complaint.status === 'action_taken') {
    const admin = createAdminClient();
    const { data: complaintRow } = await admin
      .from('complaints')
      .select('id')
      .eq('tracking_id', decodeURIComponent(params.trackingId).trim().toUpperCase())
      .maybeSingle();

    if (complaintRow) {
      const complaintId = (complaintRow as { id: string }).id;
      const { data: proofRow } = await admin
        .from('proof_of_action')
        .select('action_taken, resolution_explanation, created_at')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      proofOfAction = proofRow as { action_taken: string; resolution_explanation: string | null; created_at: string } | null;

      resolutionEvidence = await getResolutionEvidenceSignedUrls(trackingId, user.id);
    }

    feedback = await getFeedbackByTrackingId(trackingId);
  }

  const privacyMeta = PRIVACY_PRESENTATION[complaint.privacy_mode];
  const priorityMeta = PRIORITY_PRESENTATION[complaint.priority];

  return (
    <div className="container-page max-w-4xl py-10 md:py-14">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      {/* --------------------------------------------------------- header */}
      <Card className="mt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-bold tracking-tight text-blue-900 md:text-base">
              {complaint.tracking_id}
            </p>
            <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {complaint.title}
            </h1>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge tone={statusTone(complaint.status)}>
              {statusLabel(complaint.status)}
            </Badge>
            <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Meta
            icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Category"
            value={complaint.complaint_categories?.label ?? 'Uncategorised'}
          />
          <Meta
            icon={<UserCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Privacy"
            value={privacyMeta.label}
          />
          <Meta
            icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Submitted"
            value={formatComplaintDateTime(complaint.submitted_at)}
          />
        </dl>

        <div className="mt-6 rounded-xl border border-slate-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {privacyMeta.label} mode
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {privacyMeta.detail}
            {complaint.privacy_mode === 'anonymous' && privacy?.anonymous_alias ? (
              <>
                {' '}
                Handlers see you as{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {privacy.anonymous_alias}
                </span>
                .
              </>
            ) : null}
          </p>
        </div>

        {complaint.is_sensitive ? (
          <Alert tone="warning" title="Protected safety case" className="mt-6">
            This report is sealed. Only the safety officer assigned to your case can
            open it — it is invisible to every other member of staff.
          </Alert>
        ) : null}

        {/*
          Sprint 2: the immediate-danger flag is surfaced to the reporting student
          only. Handler-facing views land with the case dashboards.
        */}
        {complaint.immediate_danger ? (
          <Alert tone="error" title="Flagged as immediate danger" className="mt-4">
            You marked this report as urgent, so it sits at the top of the safety
            desk&apos;s queue. If you are unsafe right now, contact campus security or
            your local emergency number as well.
          </Alert>
        ) : null}
      </Card>

      {/* ------------------------------------------- identity access requests */}
      {actionableRequests.map((req) => (
        <div key={req.id} className="mt-6">
          <IdentityPermissionCard
            requestId={req.id}
            requestedByRole={req.requested_by_role}
            reason={req.reason}
            trackingId={complaint.tracking_id}
            status={req.status}
          />
        </div>
      ))}
      {decidedRequests.map((req) => (
        <div key={req.id} className="mt-6">
          <IdentityPermissionCard
            requestId={req.id}
            requestedByRole={req.requested_by_role}
            reason={req.reason}
            trackingId={complaint.tracking_id}
            status={req.status}
          />
        </div>
      ))}

      {/* ---------------------------------------------------- description */}
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {complaint.is_sensitive ? (
            <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-blue-900" aria-hidden="true" />
          )}
          What you reported
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {complaint.description}
        </p>
      </Card>

      {/* -------------------------------------------------------- evidence */}
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Paperclip className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Evidence
          {evidence.length > 0 ? (
            <span className="text-sm font-medium text-slate-400">
              ({evidence.length})
            </span>
          ) : null}
        </h2>
        <p className="mb-5 mt-2 text-sm text-slate-600">
          Files are held in a private bucket. Preview links below expire after one
          hour.
        </p>
        <EvidenceGallery evidence={evidence} />
      </Card>

      {/* -------------------------------------------------------- timeline */}
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <History className="h-5 w-5 text-blue-900" aria-hidden="true" />
          Status timeline
        </h2>
        <div className="mt-6">
          <StatusTimeline history={history} />
        </div>
      </Card>

      {/* ---------------------------------------------------- resolution */}
      {proofOfAction && (
        <div className="mt-6">
          <ResolutionView
            resolution={{
              proofOfAction,
              resolutionEvidence,
              feedback,
            }}
          />
        </div>
      )}

      {/* ----------------------------------------------------- feedback */}
      {complaint.status === 'resolved' && (
        <div className="mt-6">
          <FeedbackForm
            trackingId={trackingId}
            existingFeedback={feedback}
            onSuccess={() => {}}
          />
        </div>
      )}
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gray-50 p-4">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
