import { BookOpen, FileText, HelpCircle } from 'lucide-react';
import { HoverCard } from '@/components/ui/Card';

const RESOURCES = [
  {
    title: 'Know Your Rights',
    description:
      'Understand the protections every university student is entitled to.',
    Icon: BookOpen,
    iconWrapper: 'bg-blue-50',
    iconColor: 'text-blue-900',
  },
  {
    title: 'University Policies',
    description:
      'Read the codes of conduct and grievance policies that apply to you.',
    Icon: FileText,
    iconWrapper: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    title: 'Student FAQs',
    description:
      'Answers to the most common questions about reporting and privacy.',
    Icon: HelpCircle,
    iconWrapper: 'bg-green-50',
    iconColor: 'text-green-600',
  },
] as const;

export function Resources() {
  return (
    <section id="resources" className="section-y scroll-mt-24 bg-gray-50">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Student Rights &amp; Resources
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Know where you stand before you raise your voice.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {RESOURCES.map(({ title, description, Icon, iconWrapper, iconColor }) => (
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
