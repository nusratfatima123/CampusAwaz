'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  FileText,
  Search,
  UserCheck,
  Eye,
  AlertTriangle,
  BarChart3,
  Shield,
  Flame,
  CheckCircle,
  Hash,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Spinner, LoadingBlock } from '@/components/ui/Spinner';
import {
  COMPLAINT_STATUS_PRESENTATION,
  PRIORITY_PRESENTATION,
  formatComplaintDate,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import { cn } from '@/lib/cn';
import type { ComplaintStatus } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  total: number;
  open: number;
  assigned: number;
  inReview: number;
  escalated: number;
  resolved: number;
  highPriority: number;
  sensitive: number;
  overdue: number;
}

export interface ComplaintListItem {
  id: string;
  trackingId: string;
  title: string;
  status: ComplaintStatus;
  priority: string;
  privacyMode: string;
  isSensitive: boolean;
  submittedAt: string;
  updatedAt: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  studentName: string | null;
  studentAlias: string | null;
}

interface AdminDashboardProps {
  initialSummary: DashboardSummary;
  initialItems: ComplaintListItem[];
  initialTotal: number;
}

// ---------------------------------------------------------------------------
// Summary Cards
// ---------------------------------------------------------------------------

function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    {
      label: 'Total',
      value: summary.total,
      icon: Hash,
      tone: 'slate' as const,
    },
    {
      label: 'Open',
      value: summary.open,
      icon: FileText,
      tone: 'info' as const,
    },
    {
      label: 'Assigned',
      value: summary.assigned,
      icon: UserCheck,
      tone: 'purple' as const,
    },
    {
      label: 'In Review',
      value: summary.inReview,
      icon: Eye,
      tone: 'warning' as const,
    },
    {
      label: 'Escalated',
      value: summary.escalated,
      icon: AlertTriangle,
      tone: 'danger' as const,
    },
    {
      label: 'Resolved',
      value: summary.resolved,
      icon: CheckCircle,
      tone: 'green' as const,
    },
    {
      label: 'High Priority',
      value: summary.highPriority,
      icon: Flame,
      tone: 'orange' as const,
    },
    {
      label: 'Sensitive',
      value: summary.sensitive,
      icon: Shield,
      tone: 'rose' as const,
    },
    {
      label: 'Overdue',
      value: summary.overdue,
      icon: Clock,
      tone: 'danger' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="flex items-center gap-4 p-5">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              card.tone === 'slate' && 'bg-slate-100 text-slate-700',
              card.tone === 'info' && 'bg-blue-100 text-blue-700',
              card.tone === 'purple' && 'bg-purple-100 text-purple-700',
              card.tone === 'warning' && 'bg-amber-100 text-amber-700',
              card.tone === 'danger' && 'bg-red-100 text-red-700',
              card.tone === 'green' && 'bg-emerald-100 text-emerald-700',
              card.tone === 'orange' && 'bg-orange-100 text-orange-700',
              card.tone === 'rose' && 'bg-rose-100 text-rose-700',
            )}
          >
            <card.icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  onFilter,
}: {
  onFilter: (filters: Record<string, string>) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  function handleApply() {
    const filters: Record<string, string> = {};
    if (search.trim()) filters.search = search.trim();
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    onFilter(filters);
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by title or tracking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-full md:w-40">
          <label
            htmlFor="filter-status"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="assigned">Assigned</option>
            <option value="in_review">In Review</option>
            <option value="action_taken">Action Taken</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
            <option value="reopened">Reopened</option>
          </select>
        </div>
        <div className="w-full md:w-40">
          <label
            htmlFor="filter-priority"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Priority
          </label>
          <select
            id="filter-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <Button size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Complaint Table
// ---------------------------------------------------------------------------

function ComplaintTable({ items }: { items: ComplaintListItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="py-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <p className="mt-4 text-base font-medium text-slate-600">
          No complaints found
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting your filters or check back later.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Tracking ID
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Category
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Priority
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Status
              </th>
              <th className="hidden px-4 py-3 font-semibold text-slate-700 md:table-cell">
                Department
              </th>
              <th className="hidden px-4 py-3 font-semibold text-slate-700 lg:table-cell">
                Assigned To
              </th>
              <th className="hidden px-4 py-3 font-semibold text-slate-700 md:table-cell">
                Submitted
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const priorityMeta =
                PRIORITY_PRESENTATION[item.priority as keyof typeof PRIORITY_PRESENTATION];
              return (
                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-blue-900">
                      {item.trackingId}
                    </span>
                    {item.isSensitive && (
                      <Badge tone="danger" className="ml-2">
                        Sensitive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.categoryLabel ?? item.categoryKey ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {priorityMeta && (
                      <Badge tone={priorityMeta.tone}>
                        {priorityMeta.label}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {item.departmentName ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                    {item.assignedToName ?? 'Unassigned'}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {formatComplaintDate(item.submittedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/complaints/${item.trackingId}`}
                      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-900"
                      aria-label={`View complaint ${item.trackingId}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function AdminDashboard({
  initialSummary,
  initialItems,
  initialTotal,
}: AdminDashboardProps) {
  const [items, setItems] = useState(initialItems);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(
    async (filters: Record<string, string> = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/complaints/admin?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load');
        setItems(json.items ?? []);
        setSummary(json.summary ?? initialSummary);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load complaints.',
        );
      } finally {
        setLoading(false);
      }
    },
    [initialSummary],
  );

  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />

      <div className="flex justify-end">
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-blue-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          View Analytics
        </Link>
      </div>

      <FilterBar onFilter={fetchComplaints} />

      {error && (
        <Alert tone="error" title="Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingBlock label="Loading complaints..." />
      ) : (
        <ComplaintTable items={items} />
      )}

      {!loading && items.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          Showing {items.length} of {initialTotal} complaints
        </p>
      )}
    </div>
  );
}
