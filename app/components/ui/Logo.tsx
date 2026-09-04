import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

/** Wordmark + tagline lockup used in the navbar, footer and auth shell. */
export function Logo({
  href = '/',
  showTagline = true,
  inverse = false,
  className,
}: {
  href?: string;
  showTagline?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        className
      )}
      aria-label={`${APP_NAME} — ${APP_TAGLINE}`}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105',
          inverse ? 'bg-white' : 'bg-blue-900'
        )}
        aria-hidden="true"
      >
        <Megaphone className={cn('h-5 w-5', inverse ? 'text-blue-900' : 'text-white')} />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            'text-lg font-bold tracking-tight',
            inverse ? 'text-white' : 'text-slate-900'
          )}
        >
          {APP_NAME}
        </span>
        {showTagline ? (
          <span
            className={cn(
              'text-xs font-medium',
              inverse ? 'text-blue-100' : 'text-slate-500'
            )}
          >
            {APP_TAGLINE}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
