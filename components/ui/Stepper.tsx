import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepperItem {
  label: string;
  complete?: boolean;
  optional?: boolean;
}

/** Horizontal progress stepper used by registration and the verification hub. */
export function Stepper({
  items,
  currentIndex,
  className,
}: {
  items: StepperItem[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol
      className={cn('flex w-full items-center gap-2', className)}
      aria-label="Progress"
    >
      {items.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isComplete = item.complete ?? index < currentIndex;

        return (
          <li key={item.label} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition',
                  isComplete
                    ? 'bg-green-600 text-white'
                    : isCurrent
                      ? 'bg-blue-900 text-white ring-4 ring-blue-100'
                      : 'bg-slate-100 text-slate-500'
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs font-medium',
                  isCurrent ? 'text-blue-900' : 'text-slate-500'
                )}
              >
                {item.label}
                {item.optional ? (
                  <span className="text-slate-400"> (optional)</span>
                ) : null}
              </span>
            </div>

            {index < items.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'mb-6 h-0.5 w-full flex-1 rounded-full transition',
                  isComplete ? 'bg-green-600' : 'bg-slate-200'
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
