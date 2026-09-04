'use client';

import { GraduationCap, School, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StudentType } from '@/types/database';

const OPTIONS: {
  value: StudentType;
  title: string;
  description: string;
  Icon: typeof School;
  iconWrapper: string;
  iconColor: string;
}[] = [
  {
    value: 'current_student',
    title: 'Current Student',
    description: 'I am currently enrolled in a degree programme.',
    Icon: School,
    iconWrapper: 'bg-blue-50',
    iconColor: 'text-blue-900',
  },
  {
    value: 'graduate',
    title: 'Graduate / Alumni',
    description: 'I have completed my degree at this university.',
    Icon: GraduationCap,
    iconWrapper: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
];

/** Two large selection cards for current student vs graduate. */
export function StatusSelector({
  value,
  onSelect,
  disabled,
}: {
  value: StudentType | null;
  onSelect: (next: StudentType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Student status">
      {OPTIONS.map(({ value: option, title, description, Icon, iconWrapper, iconColor }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(option)}
            className={cn(
              'relative rounded-2xl border p-6 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60',
              selected
                ? 'border-blue-900 bg-blue-50 shadow-sm'
                : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
            )}
          >
            {selected ? (
              <span
                className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-blue-900"
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5 text-white" />
              </span>
            ) : null}

            <span
              className={cn(
                'mb-5 flex h-12 w-12 items-center justify-center rounded-xl',
                iconWrapper
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-6 w-6', iconColor)} />
            </span>

            <span className="block text-lg font-bold text-slate-900">{title}</span>
            <span className="mt-2 block text-sm leading-relaxed text-slate-600">
              {description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
