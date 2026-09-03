'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = [
  {
    title: 'Academic',
    description: 'Grading, courses, faculty conduct and exam concerns.',
    Icon: GraduationCap,
    iconWrapper: 'bg-blue-50',
    iconColor: 'text-blue-900',
  },
  {
    title: 'Safety & Harassment',
    description: 'Harassment, bullying and threats to personal safety.',
    Icon: ShieldAlert,
    iconWrapper: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    title: 'Facilities',
    description: 'Classrooms, labs, transport, water and cleanliness.',
    Icon: Wrench,
    iconWrapper: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    title: 'Administration',
    description: 'Fees, documents, admissions and office delays.',
    Icon: ClipboardList,
    iconWrapper: 'bg-slate-100',
    iconColor: 'text-slate-700',
  },
  {
    title: 'Hostel',
    description: 'Accommodation, mess, wardens and hostel rules.',
    Icon: Building2,
    iconWrapper: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    title: 'Mental Health',
    description: 'Counseling support, stress and wellbeing concerns.',
    Icon: HeartHandshake,
    iconWrapper: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
] as const;

/**
 * Category grid. Sprint 1 has no complaint flow, so each card nudges the
 * visitor to register instead.
 */
export function Categories() {
  const router = useRouter();
  const { showToast } = useToast();

  function goToRegister() {
    showToast('Please register to continue', 'info');
    router.push('/register');
  }

  return (
    <section id="categories" className="section-y scroll-mt-24 bg-white">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            What Can We Help With?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Whatever the issue, there is a route to a real answer.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(
            ({ title, description, Icon, iconWrapper, iconColor }) => (
              <button
                key={title}
                type="button"
                onClick={goToRegister}
                className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <span
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${iconWrapper}`}
                  aria-hidden="true"
                >
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </span>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-900">
                  Report an issue
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </button>
            )
          )}
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={goToRegister}
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-blue-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            View All Categories
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
