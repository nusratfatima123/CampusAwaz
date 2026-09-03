'use client';

import {
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Star,
  Building2,
  Tag,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { AnalyticsSummary } from '@/types/database';

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Clock;
  tone: 'info' | 'warning' | 'danger' | 'success' | 'purple' | 'neutral';
}) {
  const toneStyles: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    neutral: 'bg-slate-100 text-slate-700',
  };

  return (
    <Card className="flex items-center gap-4 p-5">
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          toneStyles[tone],
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function HorizontalBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-700">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
          {value}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-label={`${label}: ${value}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-blue-700 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ data }: { data: AnalyticsSummary }) {
  const maxCategory = Math.max(...data.byCategory.map((c) => c.total), 1);
  const maxDepartment = Math.max(...data.byDepartment.map((d) => d.total), 1);

  return (
    <div className="space-y-8">
      <div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        role="region"
        aria-label="Analytics summary"
        aria-live="polite"
      >
        <StatCard
          label="Pending"
          value={data.pendingCount}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Escalated"
          value={data.escalatedCount}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Resolution Rate"
          value={`${Math.round(data.resolutionRate)}%`}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Avg Resolution"
          value={
            data.avgResolutionHours != null
              ? `${data.avgResolutionHours.toFixed(1)}h`
              : 'N/A'
          }
          icon={CheckCircle2}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Feedback"
          value={data.totalFeedback}
          icon={Star}
          tone="purple"
        />
        <StatCard
          label="Avg Rating"
          value={data.avgRating != null ? data.avgRating.toFixed(1) : 'N/A'}
          icon={Star}
          tone="purple"
        />
        <StatCard
          label="Total Escalations"
          value={data.totalEscalations}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Categories"
          value={data.byCategory.length}
          icon={Tag}
          tone="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-900">By Category</h3>
          </div>
          {data.byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No complaints yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.byCategory.map((c) => (
                <HorizontalBar
                  key={c.categoryKey ?? '_none'}
                  label={c.categoryLabel ?? c.categoryKey ?? 'Unknown'}
                  value={c.total}
                  max={maxCategory}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-900">By Department</h3>
          </div>
          {data.byDepartment.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No department data yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.byDepartment.map((d) => (
                <HorizontalBar
                  key={d.departmentKey ?? '_none'}
                  label={d.departmentName ?? d.departmentKey ?? 'Unknown'}
                  value={d.total}
                  max={maxDepartment}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {data.recurringFacilityIssues.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-900">
              Recurring Facility Issues
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Count</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recurringFacilityIssues.map((issue) => (
                  <tr key={issue.categoryKey ?? '_none'} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {issue.categoryLabel ?? issue.categoryKey ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="warning">{issue.total}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">Needs attention</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
