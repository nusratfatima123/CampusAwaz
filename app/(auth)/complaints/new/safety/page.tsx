import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Phone, ShieldAlert, UserCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { ComplaintForm } from '@/components/complaints/ComplaintForm';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getCategoryByKey } from '@/lib/complaints';
import { SENSITIVE_CATEGORY_KEY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Report harassment or a safety concern',
  description:
    'A protected reporting channel. Only the safety desk assigned to your case can read this report.',
};

/**
 * Protected harassment & safety reporting flow.
 *
 * Reports filed here are stored with `is_sensitive = true` and routed exclusively
 * to the university's Female Focal Person (falling back to a Proctor, Admin or
 * Counselor). No other staff member — including unassigned administrators — can
 * read them.
 */
export default async function SafetyComplaintPage() {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!profile?.university_id) {
    redirect('/verify/university');
  }

  const category = await getCategoryByKey(SENSITIVE_CATEGORY_KEY);

  if (!category) {
    return (
      <div className="container-page max-w-3xl py-10 md:py-14">
        <Alert tone="warning" title="Safety reporting unavailable">
          The Safety &amp; Harassment category is not configured. Apply the{' '}
          <code className="font-mono text-xs">002_complaints.sql</code> migration,
          then reload this page.
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <Link
        href="/complaints/new"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Change category
      </Link>

      {/* ---------------------------------------------- protected header */}
      <Card className="mt-6 border-red-200 bg-red-50/50">
        <div className="flex flex-col items-start gap-5 sm:flex-row">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100"
            aria-hidden="true"
          >
            <ShieldAlert className="h-6 w-6 text-red-700" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              You are safe to speak here
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              This is a protected channel. Your report goes only to the Female Focal
              Person responsible for harassment and safety at your university — no
              department, no faculty member, and no unassigned administrator can open
              it.
            </p>
          </div>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          <Assurance
            icon={<Lock className="h-4 w-4" aria-hidden="true" />}
            title="Sealed case file"
            body="Stored as a sensitive case with restricted database access."
          />
          <Assurance
            icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
            title="One named handler"
            body="Routed to a single authorized safety officer."
          />
          <Assurance
            icon={<Phone className="h-4 w-4" aria-hidden="true" />}
            title="Urgent flag"
            body="Mark immediate danger to push this to the top."
          />
        </ul>
      </Card>

      <Alert tone="warning" title="If you are in danger right now" className="mt-6">
        Do not rely on this form for an emergency. Contact campus security or your
        local emergency number first, get somewhere safe, then file this report so
        there is a permanent record.
      </Alert>

      <div className="mt-8">
        <ComplaintForm
          categoryId={category.id}
          categoryKey={category.key}
          categoryLabel={category.label}
          categoryDescription="Tell us what happened in your own words. Include dates, locations, who was involved and anyone who witnessed it. Write only what you are comfortable writing."
          isSensitive
          showImmediateDanger
          defaultPrivacyMode="confidential"
          recommendedPrivacyMode="confidential"
          descriptionPrompt="Tell us what happened"
          descriptionPlaceholder="You can write as much or as little as you want. Anything you share stays inside the protected case file."
        />
      </div>
    </div>
  );
}

function Assurance({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-red-100 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="text-red-700">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}
