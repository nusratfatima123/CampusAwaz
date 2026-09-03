import Link from 'next/link';
import {
  Banknote,
  BookOpen,
  Building,
  BedDouble,
  FileQuestion,
  HeartPulse,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { HoverCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SENSITIVE_CATEGORY_KEY } from '@/lib/constants';
import type { ComplaintCategory } from '@/types/database';

const ICONS: Record<string, LucideIcon> = {
  academic: BookOpen,
  facilities: Wrench,
  hostel: BedDouble,
  financial: Banknote,
  administration: Building,
  safety_harassment: ShieldAlert,
  mental_health: HeartPulse,
  other: FileQuestion,
};

/**
 * Category picker. "Safety & Harassment" is routed to the dedicated protected
 * flow at /complaints/new/safety; everything else uses the standard form.
 */
export function CategoryGrid({ categories }: { categories: ComplaintCategory[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const Icon = ICONS[category.key] ?? FileQuestion;
        const sensitive = category.key === SENSITIVE_CATEGORY_KEY;
        const href = sensitive
          ? '/complaints/new/safety'
          : `/complaints/new/${category.key}`;

        return (
          <li key={category.id}>
            <Link
              href={href}
              className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <HoverCard
                className={
                  sensitive
                    ? 'h-full border-red-200 bg-red-50/40 p-5 md:p-6'
                    : 'h-full p-5 md:p-6'
                }
              >
                <span
                  className={
                    sensitive
                      ? 'mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700'
                      : 'mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-900'
                  }
                  aria-hidden="true"
                >
                  <Icon className="h-6 w-6" />
                </span>

                <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
                  {category.label}
                  {sensitive ? (
                    <Badge tone="danger">Protected flow</Badge>
                  ) : null}
                </h3>

                {category.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {category.description}
                  </p>
                ) : null}
              </HoverCard>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
