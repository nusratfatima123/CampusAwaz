import { Lock, Search, ShieldCheck } from 'lucide-react';
import { HoverCard } from '@/components/ui/Card';

const FEATURES = [
  {
    title: 'Anonymous Reporting',
    description:
      'Report sensitive issues without revealing your identity to your department.',
    Icon: Lock,
    iconWrapper: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Track Every Complaint',
    description:
      'Follow your case from submission to resolution with a live status timeline.',
    Icon: Search,
    iconWrapper: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    title: 'Real Action',
    description:
      'Every complaint is routed to the responsible office with proof of action.',
    Icon: ShieldCheck,
    iconWrapper: 'bg-blue-50',
    iconColor: 'text-blue-900',
  },
] as const;

export function Features() {
  return (
    <section className="bg-white pb-16 md:pb-24" aria-label="Platform highlights">
      <div className="container-page">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, description, Icon, iconWrapper, iconColor }) => (
            <HoverCard key={title}>
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
            </HoverCard>
          ))}
        </div>
      </div>
    </section>
  );
}
