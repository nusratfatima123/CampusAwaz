import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  Building2,
  FileText,
  GraduationCap,
  Inbox,
  Plus,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import {
  ComplaintCard,
  ComplaintCardSkeleton,
} from '@/components/complaints/ComplaintCard';
import { getAuthContext, displayName } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { isStaff } from '@/lib/roles';
import { getStudentComplaints } from '@/lib/complaints';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track the complaints you have filed on CampusAwaz.',
};

export default async function DashboardPage() {
  const { user, profile, roles, verifications } = await getAuthContext();

  if (!user) redirect('/login');
  // Middleware handles this too; kept so the page is safe in isolation.
  if (!isVerified(profile)) redirect('/pending');

  // Staff users have their own dashboard; redirect them there.
  if (isStaff(roles)) redirect('/admin/dashboard');

  const name = displayName(profile, user);
  const flagged = verifications.some(
    (v) => v.status === 'verified' && v.needs_manual_review
  );

  const studentTypeLabel =
    profile?.student_type === 'graduate'
      ? 'Graduate / Alumni'
      : profile?.student_type === 'current_student'
        ? 'Current Student'
        : 'Not specified';

  return (
    <div className="container-page py-10 md:py-14">
      {/* -------------------------------------------------------- Welcome */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Welcome, {name}
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Raise a complaint, follow its progress, and keep every step on record.
            </p>
          </div>
          <Badge tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            Verified
          </Badge>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-gray-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              University
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {profile?.universities?.name ?? 'Not selected'}
              {profile?.universities?.code ? (
                <span className="ml-1 font-normal text-slate-500">
                  ({profile.universities.code})
                </span>
              ) : null}
            </dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-gray-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Status
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {studentTypeLabel}
            </dd>
          </div>
        </dl>

        {flagged ? (
          <Alert tone="warning" title="Manual review pending" className="mt-6">
            One of your uploaded documents was hard to read automatically. You keep
            full access while an administrator double-checks it.
          </Alert>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/complaints/new" size="lg">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New complaint
          </ButtonLink>
          <ButtonLink href="/complaints/new/safety" variant="secondary" size="lg">
            <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
            Report harassment or a safety concern
          </ButtonLink>
        </div>
      </Card>

      {/* --------------------------------------------------- My complaints */}
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <FileText className="h-5 w-5 text-blue-900" aria-hidden="true" />
              My complaints
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Everything you have filed, newest first.
            </p>
          </div>
        </div>

        <Suspense fallback={<ComplaintListSkeleton />}>
          <ComplaintList userId={user.id} />
        </Suspense>
      </section>
    </div>
  );
}

async function ComplaintList({ userId }: { userId: string }) {
  const complaints = await getStudentComplaints(userId);

  if (complaints.length === 0) {
    return (
      <Card className="flex flex-col items-center py-14 text-center">
        <span
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50"
          aria-hidden="true"
        >
          <Inbox className="h-8 w-8 text-blue-900" />
        </span>
        <h3 className="text-lg font-bold text-slate-900">No complaints yet</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          When something on campus is not right — academics, facilities, hostel,
          safety — file it here and CampusAwaz will route it to the right desk and
          keep a permanent record.
        </p>
        <ButtonLink href="/complaints/new" size="lg" className="mt-6">
          <Plus className="h-4 w-4" aria-hidden="true" />
          File your first complaint
        </ButtonLink>
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {complaints.map((complaint) => (
        <li key={complaint.id}>
          <ComplaintCard complaint={complaint} />
        </li>
      ))}
    </ul>
  );
}

function ComplaintListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <ComplaintCardSkeleton key={index} />
      ))}
    </div>
  );
}
