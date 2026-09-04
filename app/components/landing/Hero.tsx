'use client';

import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

/**
 * Landing hero. In Sprint 1 both CTAs funnel to /register with a soft toast,
 * because the complaint flow ships in Sprint 2.
 */
export function Hero() {
  const router = useRouter();
  const { showToast } = useToast();

  function goToRegister() {
    showToast('Please register to continue', 'info');
    router.push('/register');
  }

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Soft background wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-50/70 via-white to-white"
        aria-hidden="true"
      />

      <div className="container-page relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-900">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Trusted by students across Pakistan
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Your Voice. Your Safety.{' '}
            <span className="text-blue-900">Your Rights.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            A trusted platform for university students to report problems, seek
            support, and track real action — safely and confidentially.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={goToRegister}>
              Submit a Complaint
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button size="lg" variant="secondary" onClick={goToRegister}>
              <Compass className="h-4 w-4" aria-hidden="true" />
              Explore Support
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-10 inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700">
              Anonymous <span className="text-slate-300">•</span> Secure{' '}
              <span className="text-slate-300">•</span> Fast Resolution
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
