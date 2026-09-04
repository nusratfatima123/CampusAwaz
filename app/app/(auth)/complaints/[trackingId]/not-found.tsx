import { FileQuestion } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';

/**
 * Shown when a tracking ID does not exist *or* does not belong to the caller.
 * The wording is deliberately identical in both cases so nothing leaks about
 * other students' complaints.
 */
export default function ComplaintNotFound() {
  return (
    <div className="container-page max-w-2xl py-14 md:py-20">
      <Card className="text-center">
        <span
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100"
          aria-hidden="true"
        >
          <FileQuestion className="h-8 w-8 text-slate-500" />
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Complaint not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600">
          We could not find a complaint with that tracking ID under your account.
          Check the ID and try again.
        </p>

        <div className="mt-8">
          <ButtonLink href="/dashboard" size="lg">
            Back to dashboard
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
