import { ArrowRight, CheckCircle2, PencilLine, Search, Shield } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    title: 'Report',
    description: 'Describe what happened in your own words.',
    Icon: PencilLine,
    iconWrapper: 'bg-blue-50',
    iconColor: 'text-blue-900',
  },
  {
    number: '02',
    title: 'Protect',
    description: 'Choose how much of your identity to share.',
    Icon: Shield,
    iconWrapper: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    number: '03',
    title: 'Track',
    description: 'Watch your complaint move through each stage.',
    Icon: Search,
    iconWrapper: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    number: '04',
    title: 'Resolve',
    description: 'Receive documented action and give feedback.',
    Icon: CheckCircle2,
    iconWrapper: 'bg-green-50',
    iconColor: 'text-green-600',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-y scroll-mt-24 bg-gray-50">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            How CampusAwaz Works
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Four simple steps from raising your voice to seeing real change.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {STEPS.map(
            ({ number, title, description, Icon, iconWrapper, iconColor }, index) => (
              <li key={number} className="relative flex">
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconWrapper}`}
                      aria-hidden="true"
                    >
                      <Icon className={`h-6 w-6 ${iconColor}`} />
                    </span>
                    <span className="text-2xl font-bold text-slate-200">{number}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {description}
                  </p>
                </div>

                {/* Connector arrow — desktop only */}
                {index < STEPS.length - 1 ? (
                  <span
                    className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 lg:block"
                    aria-hidden="true"
                  >
                    <ArrowRight className="h-5 w-5 text-slate-300" />
                  </span>
                ) : null}
              </li>
            )
          )}
        </ol>
      </div>
    </section>
  );
}
