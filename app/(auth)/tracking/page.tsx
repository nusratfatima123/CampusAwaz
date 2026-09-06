import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TrackingLookup } from '@/components/student/TrackingLookup';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Track Complaint',
  description: 'Look up the status of your complaint using its tracking ID.',
};

export const dynamic = 'force-dynamic';

/**
 * Student tracking page: lookup a complaint by tracking ID.
 * The actual complaint detail is shown on the existing complaints/[trackingId] page.
 */
export default async function TrackingPage() {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!profile?.university_id) {
    redirect('/verify/university');
  }

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-lg">
        <Card>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
              <Search className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              Track your complaint
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter the tracking ID you received when you submitted your complaint
              to see its current status and timeline.
            </p>
          </div>

          <div className="mt-8">
            <TrackingLookup />
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Your tracking ID looks like <span className="font-mono font-semibold">CA-FAST-2026-00001</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
