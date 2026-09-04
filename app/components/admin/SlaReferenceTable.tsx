'use client';

import { Card } from '@/components/ui/Card';
import {
  SLA_REFERENCE_TABLE,
  SLA_PRIORITY_LABELS,
  CATEGORY_AUTHORITY_LABELS,
} from '@/lib/constants';

const CATEGORY_LABELS: Record<string, string> = {
  academic: 'Academic',
  facilities: 'Facilities',
  hostel: 'Hostel',
  financial: 'Financial',
  administration: 'Administrative',
  safety_harassment: 'Safety & Harassment',
  mental_health: 'Mental Health',
  other: 'Other',
};

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

function slaBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatHours(h: number): string {
  if (h < 24) return `${h}h`;
  if (h % 24 === 0) return `${h / 24}d`;
  return `${h}h`;
}

export function SlaReferenceTable() {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
        SLA Response Deadlines
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2 text-left font-medium text-slate-600">Category</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Authority</th>
              {PRIORITY_ORDER.map((p) => (
                <th key={p} className="px-4 py-2 text-center font-medium text-slate-600">
                  {SLA_PRIORITY_LABELS[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(SLA_REFERENCE_TABLE).map(([catKey, priorities]) => (
              <tr key={catKey} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {CATEGORY_LABELS[catKey] ?? catKey}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {CATEGORY_AUTHORITY_LABELS[catKey] ?? 'Administration'}
                </td>
                {PRIORITY_ORDER.map((p) => (
                  <td key={p} className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${slaBadgeClass(p)}`}
                    >
                      {formatHours(priorities[p] ?? 72)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
