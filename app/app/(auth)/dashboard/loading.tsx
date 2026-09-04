import { Card } from '@/components/ui/Card';
import { ComplaintCardSkeleton } from '@/components/complaints/ComplaintCard';

/** Dashboard loading skeleton. */
export default function DashboardLoading() {
  return (
    <div className="container-page py-10 md:py-14">
      <Card>
        <div className="animate-pulse space-y-4" aria-hidden="true">
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="h-4 w-full max-w-lg rounded bg-slate-100" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="h-20 rounded-xl bg-slate-100" />
            <div className="h-20 rounded-xl bg-slate-100" />
          </div>
          <div className="mt-6 h-12 w-48 rounded-xl bg-slate-200" />
        </div>
      </Card>

      <div className="mt-10">
        <div
          className="mb-5 h-6 w-40 animate-pulse rounded bg-slate-200"
          aria-hidden="true"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <ComplaintCardSkeleton key={index} />
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        Loading your dashboard…
      </p>
    </div>
  );
}
