import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/** Consistent chrome for each single-step verification screen. */
export function VerifyStepShell({
  title,
  description,
  children,
  backHref = '/verify',
  backLabel = 'Back to verification',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-slate-600 transition hover:text-blue-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        <Card className="mt-8">{children}</Card>
      </div>
    </div>
  );
}
