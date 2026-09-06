import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ComplaintForm } from '@/components/complaints/ComplaintForm';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getCategoryByKey } from '@/lib/complaints';
import { SENSITIVE_CATEGORY_KEY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'File a complaint',
  description: 'Describe the problem in your own words.',
};

/**
 * Standard complaint form for every non-sensitive category.
 * The sensitive category is intentionally rejected here so harassment reports can
 * only be filed through the protected flow at /complaints/new/safety.
 */
export default async function StandardComplaintPage({
  params,
}: {
  params: { categoryKey: string };
}) {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');
  if (!profile?.university_id) {
    redirect('/verify/university');
  }

  if (params.categoryKey === SENSITIVE_CATEGORY_KEY) {
    redirect('/complaints/new/safety');
  }

  const category = await getCategoryByKey(params.categoryKey);
  if (!category) notFound();
  // Defence in depth: a sensitive category must never render the standard form.
  if (category.is_sensitive) redirect('/complaints/new/safety');

  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <Link
        href="/complaints/new"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Change category
      </Link>

      <header className="mt-6 mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-900">
          {category.label}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          File a complaint
        </h1>
      </header>

      <ComplaintForm
        categoryId={category.id}
        categoryKey={category.key}
        categoryLabel={category.label}
        categoryDescription={category.description}
      />
    </div>
  );
}
