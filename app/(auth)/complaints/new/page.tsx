import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { CategoryGrid } from '@/components/complaints/CategoryGrid';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getActiveCategories } from '@/lib/complaints';

export const metadata: Metadata = {
  title: 'New complaint',
  description: 'Choose what your complaint is about.',
};

export default async function NewComplaintPage() {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!profile?.university_id) redirect('/verify/university');

  const categories = await getActiveCategories();

  return (
    <div className="container-page max-w-5xl py-10 md:py-14">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          What is your complaint about?
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Pick the closest match. You will describe the problem in your own words on
          the next screen — there is no rigid form to fill in.
        </p>
      </header>

      <div className="mt-8">
        {categories.length === 0 ? (
          <Alert tone="warning" title="Categories unavailable">
            No complaint categories are configured yet. Apply the{' '}
            <code className="font-mono text-xs">002_complaints.sql</code> migration to
            seed them.
          </Alert>
        ) : (
          <CategoryGrid categories={categories} />
        )}
      </div>

      <Alert tone="info" title="Your privacy is your choice" className="mt-10">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          On the next screens you decide whether to stay identified, confidential or
          fully anonymous. Harassment and safety reports open a separate protected
          flow that only the safety desk can access.
        </p>
      </Alert>
    </div>
  );
}
