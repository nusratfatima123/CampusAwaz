'use client';

import { Check, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIVACY_PRESENTATION } from '@/lib/complaint-ui';
import type { PrivacyMode } from '@/types/database';

const ORDER: PrivacyMode[] = ['identified', 'confidential', 'anonymous'];

const ICONS: Record<PrivacyMode, typeof Eye> = {
  identified: Eye,
  confidential: Lock,
  anonymous: EyeOff,
};

/**
 * Three-card privacy chooser used by both the standard and the safety form.
 * `recommended` highlights the mode we nudge students toward (safety reports
 * recommend Confidential).
 */
export function PrivacySelector({
  value,
  onChange,
  recommended,
  className,
}: {
  value: PrivacyMode;
  onChange: (mode: PrivacyMode) => void;
  recommended?: PrivacyMode;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">Choose how your identity is handled</legend>

      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((mode) => {
          const meta = PRIVACY_PRESENTATION[mode];
          const Icon = ICONS[mode];
          const selected = value === mode;

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(mode)}
              className={cn(
                'group relative flex h-full flex-col items-start rounded-2xl border-2 p-5 text-left transition',
                selected
                  ? 'border-blue-900 bg-blue-50/60 shadow-md'
                  : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
              )}
            >
              {recommended === mode ? (
                <span className="absolute right-4 top-4 rounded-full bg-blue-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Recommended
                </span>
              ) : null}

              <span
                className={cn(
                  'mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition',
                  selected ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'
                )}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>

              <span className="flex items-center gap-2 text-base font-bold text-slate-900">
                {meta.label}
                {selected ? (
                  <Check className="h-4 w-4 text-blue-900" aria-hidden="true" />
                ) : null}
              </span>

              <span className="mt-1.5 text-sm font-medium text-slate-700">
                {meta.summary}
              </span>
              <span className="mt-3 text-xs leading-relaxed text-slate-500">
                {meta.detail}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
          aria-hidden="true"
        />
        Whichever mode you pick, your complaint is stored encrypted at rest and your
        privacy choice is recorded in the audit trail. You can always see your own
        complaint in full.
      </p>
    </fieldset>
  );
}
