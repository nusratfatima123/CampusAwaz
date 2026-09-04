/** Tiny className joiner — avoids pulling in clsx/tailwind-merge. */
export type ClassValue = string | number | bigint | boolean | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}
