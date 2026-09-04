import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getAuthContext } from '@/lib/auth';
import { isVerified, STATUS_PRESENTATION } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Verification required',
  description: 'Complete your verification to access CampusAwaz.',
};

const TONE_MAP = {
  neutral: 'neutral',
  info: 'info',
  warning: 'warning',
  success: 'success',
  danger: 'danger',
} as const;

/** Landing spot for unverified users bounced off a protected route. */
export default async function PendingPage() {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (isVerified(profile)) redirect('/dashboard');

  const status = profile?.affiliation_status ?? 'unverified';
  const presentation = STATUS_PRESENTATION[status];

  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <Card className="text-center">
          <span
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50"
            aria-hidden="true"
          >
            <ShieldAlert className="h-8 w-8 text-amber-600" />
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Please complete your verification first
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {presentation.description}
          </p>

          <div className="mt-6 flex justify-center">
            <Badge tone={TONE_MAP[presentation.tone]}>{presentation.label}</Badge>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href="/verify" size="lg">
              Continue verification
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Verification confirms you belong to your university, which keeps
            CampusAwaz safe and trustworthy for every student.
          </p>
        </Card>
      </div>
    </div>
  );
}
