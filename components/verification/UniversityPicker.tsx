'use client';

import { useMemo, useState } from 'react';
import { Building2, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import type { University } from '@/types/database';

export type UniversityOption = Pick<
  University,
  'id' | 'name' | 'code' | 'allowed_email_domains'
>;

/**
 * Searchable university list. Used by both registration (step 2) and the
 * standalone /verify/university screen.
 */
export function UniversityPicker({
  universities,
  selectedId,
  onSelect,
  disabled,
}: {
  universities: UniversityOption[];
  selectedId: string | null;
  onSelect: (university: UniversityOption) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universities;
    return universities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        u.allowed_email_domains.some((d) => d.toLowerCase().includes(q))
    );
  }, [universities, query]);

  return (
    <div>
      <Input
        type="search"
        label="Search universities"
        placeholder="Search by name, code or email domain"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leadingIcon={<Search className="h-4 w-4" />}
        disabled={disabled}
      />

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-gray-50 p-6 text-center text-sm text-slate-600">
          No universities match “{query}”. CampusAwaz is expanding — check back soon.
        </p>
      ) : (
        <ul className="mt-5 max-h-[22rem] space-y-2 overflow-y-auto pr-1" role="list">
          {filtered.map((university) => {
            const selected = university.id === selectedId;
            return (
              <li key={university.id}>
                <button
                  type="button"
                  onClick={() => onSelect(university)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60',
                    selected
                      ? 'border-blue-900 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      selected ? 'bg-blue-900' : 'bg-slate-100'
                    )}
                    aria-hidden="true"
                  >
                    <Building2
                      className={cn(
                        'h-5 w-5',
                        selected ? 'text-white' : 'text-slate-500'
                      )}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {university.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {university.code}
                      {university.allowed_email_domains.length > 0
                        ? ` · @${university.allowed_email_domains[0]}`
                        : ''}
                    </span>
                  </span>

                  {selected ? (
                    <Check
                      className="h-5 w-5 shrink-0 text-blue-900"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
