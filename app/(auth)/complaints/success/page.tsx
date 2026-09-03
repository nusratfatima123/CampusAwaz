import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2, Eye, LayoutDashboard } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { TrackingIdDisplay } from '@/components/complaints/TrackingIdDisplay';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { isTrackingIdShape } from '@/lib/validators';

export const metadata: Metadata = {
  title: 'Complaint submitted',
  description: 'Your complaint has been filed. Keep your tracking ID safe.',
};

export default async function ComplaintSuccessPage({
  searchParams,
}: {
  searchParams: { trackingId?: string };
}) {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');

  const trackingId = (searchParams.trackingId ?? '').trim().toUpperCase();
  if (!trackingId || !isTrackingIdShape(trackingId)) {
    redirect('/dashboard');
  }

  return (
    <div className="container-page max-w-2xl py-14 md:py-20">
      <Card className="text-center">
        <span
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50"
          aria-hidden="true"
        >
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Your complaint has been filed
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600">
          It is now on record. Save the tracking ID below — it is how you follow this
          case, even if you filed it anonymously.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-gray-50 px-5 py-8">
          <TrackingIdDisplay trackingId={trackingId} />
        </div>

        <Alert tone="info" title="What happens next" className="mt-8 text-left">
          Your complaint is queued for the responsible office at your university. Every
          status change is added to the case timeline, which you can open from your
          dashboard at any time.
        </Alert>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink
            href={`/complaints/${encodeURIComponent(trackingId)}`}
            variant="secondary"
            size="lg"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View complaint
          </ButtonLink>
          <ButtonLink href="/dashboard" size="lg">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Go to dashboard
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
