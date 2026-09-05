'use client';

import { useState, useMemo } from 'react';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { RoleName } from '@/types/database';

export interface DirectoryEntry {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role_name: RoleName;
  role_label: string;
  department_id: string | null;
  department_name: string | null;
}

export interface AuthorityDirectoryProps {
  entries: DirectoryEntry[];
}

export function AuthorityDirectory({ entries }: AuthorityDirectoryProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        (e.full_name ?? '').toLowerCase().includes(q) ||
        e.role_label.toLowerCase().includes(q) ||
        (e.department_name ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, DirectoryEntry[]>();
    for (const entry of filtered) {
      const key = entry.role_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).sort((a, b) =>
      roleLabel(a[0]).localeCompare(roleLabel(b[0]))
    );
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, role, or department..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No authorities yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            No authority roles have been assigned at your university yet.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h3 className="mt-4 text-base font-bold text-slate-900">No results</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            No authorities match &quot;{search}&quot;.
          </p>
        </div>
      ) : (
        grouped.map(([roleName, roleEntries]) => (
          <div key={roleName}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {roleLabel(roleName)}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                {roleEntries.length}
              </span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roleEntries.map((entry) => (
                <Card
                  key={`${entry.user_id}-${entry.role_name}`}
                  className="!p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {(entry.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {entry.full_name ?? 'Name not provided'}
                      </p>
                      {entry.department_name ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {entry.department_name}
                        </p>
                      ) : null}
                      {entry.phone ? (
                        <p className="mt-1 text-xs text-slate-500">{entry.phone}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Badge
                      tone={
                        roleName === 'proctor' || roleName === 'female_focal_person'
                          ? 'purple'
                          : 'info'
                      }
                    >
                      {entry.role_label}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
