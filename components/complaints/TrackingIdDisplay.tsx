'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Large tracking-ID readout with a copy-to-clipboard action. */
export function TrackingIdDisplay({
  trackingId,
  className,
}: {
  trackingId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Your tracking ID
      </p>

      <p className="break-all font-mono text-2xl font-bold tracking-tight text-blue-900 sm:text-3xl md:text-4xl">
        {trackingId}
      </p>

      <button
        type="button"
        onClick={() => void copy()}
        aria-live="polite"
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
          copied
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy tracking ID
          </>
        )}
      </button>
    </div>
  );
}
