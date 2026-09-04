import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Card variant with a hover lift — for clickable grids. */
export function HoverCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6', className)}>
      {icon ? <div className="mb-4">{icon}</div> : null}
      <h2 className="text-xl font-bold text-slate-900 md:text-2xl">{title}</h2>
      {description ? (
        <p className="mt-2 text-base leading-relaxed text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
