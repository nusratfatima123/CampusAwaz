'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, Send, ShieldAlert, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { AiRecommendationCard } from './AiRecommendationCard';
import {
  PRIVACY_PRESENTATION,
  PRIORITY_PRESENTATION,
  formatComplaintDateTime,
  statusLabel,
  statusTone,
} from '@/lib/complaint-ui';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { AssignableStaff, IntakeItem } from '@/lib/routing';
import type {
  ComplaintCategory,
  ComplaintPriority,
  Department,
} from '@/types/database';

const PRIORITY_ORDER: ComplaintPriority[] = ['low', 'medium', 'high', 'critical'];

export interface RoutingPanelProps {
  item: IntakeItem;
  departments: Pick<Department, 'id' | 'key' | 'name'>[];
  staff: AssignableStaff[];
  categories: Pick<ComplaintCategory, 'id' | 'key' | 'label' | 'is_sensitive'>[];
  /** Resolves once the decision has been applied so the parent can refresh. */
  onApplied: () => void;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

/**
 * Human-review gate for one complaint.
 *
 * The AI recommendation only ever *pre-fills* these controls — nothing is
 * applied until a staff member presses "Assign & route", which POSTs to
 * `/api/admin/intake/[trackingId]` where the server re-validates everything.
 */
export function RoutingPanel({
  item,
  departments,
  staff,
  categories,
  onApplied,
}: RoutingPanelProps) {
  const recommendation = item.recommendation;

  // Prefill: current complaint values, overridden by the AI suggestion where one
  // exists and the complaint has not already been routed.
  const initialCategoryId =
    item.categoryId ??
    (recommendation?.categoryKey
      ? categories.find((c) => c.key === recommendation.categoryKey)?.id ?? ''
      : '');
  const initialDepartmentId =
    item.departmentId ?? recommendation?.departmentId ?? '';
  const initialPriority: ComplaintPriority =
    item.departmentId ? item.priority : (recommendation?.priority ?? item.priority);

  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [priority, setPriority] = useState<ComplaintPriority>(initialPriority);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [assigneeId, setAssigneeId] = useState(item.assignedTo ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Switching rows must reset the form to that row's values.
  useEffect(() => {
    setCategoryId(initialCategoryId);
    setPriority(initialPriority);
    setDepartmentId(initialDepartmentId);
    setAssigneeId(item.assignedTo ?? '');
    setReason('');
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.trackingId]);

  // A sensitive case can only stay in the safety workflow, so only same-sensitivity
  // categories are offered.
  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (category) => Boolean(category.is_sensitive) === Boolean(item.isSensitive)
      ),
    [categories, item.isSensitive]
  );

  const selectableDepartments = useMemo(
    () =>
      item.isSensitive
        ? departments.filter((department) => department.key === 'safety_proctor')
        : departments,
    [departments, item.isSensitive]
  );

  const selectedDepartment = selectableDepartments.find(
    (department) => department.id === departmentId
  );

  // Staff are filtered by department affinity; roles with no affinity (admin,
  // for example) can take anything.
  const selectableStaff = useMemo(() => {
    const departmentKey = selectedDepartment?.key;
    return staff.filter((member) => {
      if (member.departmentKeys.length === 0) return true;
      if (!departmentKey) return true;
      return member.departmentKeys.includes(
        departmentKey as (typeof member.departmentKeys)[number]
      );
    });
  }, [staff, selectedDepartment?.key]);

  const changedFromRecommendation = Boolean(
    recommendation &&
      (recommendation.priority !== priority ||
        (recommendation.departmentId &&
          departmentId &&
          recommendation.departmentId !== departmentId) ||
        (recommendation.categoryKey &&
          categoryId &&
          categories.find((c) => c.id === categoryId)?.key !==
            recommendation.categoryKey))
  );

  function resetToRecommendation() {
    setCategoryId(
      recommendation?.categoryKey
        ? (categories.find((c) => c.key === recommendation.categoryKey)?.id ?? '')
        : ''
    );
    setPriority(recommendation?.priority ?? item.priority);
    setDepartmentId(recommendation?.departmentId ?? '');
    setError(null);
  }

  async function handleAssign() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/intake/${encodeURIComponent(item.trackingId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: categoryId || null,
            priority,
            departmentId: departmentId || null,
            assigneeId: assigneeId || null,
            reason: reason.trim() || null,
          }),
        }
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'Could not apply the routing decision.');
        return;
      }

      setSuccess('Routing decision applied.');
      onApplied();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const privacy = PRIVACY_PRESENTATION[item.privacyMode];

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- Complaint header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-blue-900">
            {item.trackingId}
          </span>
          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
          <Badge tone={PRIORITY_PRESENTATION[item.priority].tone}>
            {PRIORITY_PRESENTATION[item.priority].label}
          </Badge>
          <Badge tone={privacy.tone}>{privacy.label}</Badge>
          {item.isSensitive ? (
            <Badge tone="danger" icon={<Lock className="h-3 w-3" />}>
              Protected case
            </Badge>
          ) : null}
        </div>

        <h2 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {item.reporterName ?? item.reporterAlias ?? 'Reporter hidden'} ·{' '}
          {formatComplaintDateTime(item.submittedAt)}
        </p>
      </div>

      {item.immediateDanger ? (
        <Alert tone="error" title="Reporter flagged immediate danger">
          Treat this as critical and confirm the reporter&apos;s safety before
          anything else.
        </Alert>
      ) : null}

      {!item.reporterName ? (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {privacy.summary}
        </p>
      ) : null}

      {/* ------------------------------------------------------- Description */}
      <div className="rounded-2xl border border-slate-200 bg-gray-50 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reported description
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {item.description}
        </p>
      </div>

      {/* -------------------------------------------------- Recommendation */}
      <AiRecommendationCard recommendation={recommendation} />

      {/* ------------------------------------------------------- Controls */}
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {recommendation ? 'Confirm or override' : 'Manual routing'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {recommendation
              ? 'The values below are pre-filled from the recommendation. Nothing is applied until you assign.'
              : 'No recommendation exists for this complaint — choose the category, priority and department yourself.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="routing-category"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Category
            </label>
            <select
              id="routing-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={saving}
              className={SELECT_CLASS}
            >
              <option value="">Keep current category</option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="routing-priority"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Priority
            </label>
            <select
              id="routing-priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as ComplaintPriority)
              }
              disabled={saving}
              className={SELECT_CLASS}
            >
              {PRIORITY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_PRESENTATION[value].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="routing-department"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Department
            </label>
            <select
              id="routing-department"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setAssigneeId('');
              }}
              disabled={saving}
              className={SELECT_CLASS}
            >
              <option value="">Keep current department</option>
              {selectableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {item.isSensitive ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Safety cases stay with the Proctorial &amp; Safety Office.
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="routing-assignee"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Assign to
            </label>
            <select
              id="routing-assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              disabled={saving}
              className={SELECT_CLASS}
            >
              <option value="">Not assigned yet</option>
              {selectableStaff.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} — {roleLabel(member.role)}
                </option>
              ))}
            </select>
            {selectableStaff.length === 0 ? (
              <p className="mt-1.5 text-xs text-amber-700">
                No staff member matches this department yet.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="routing-reason"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Override note{' '}
            <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="routing-reason"
            rows={3}
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
            placeholder="Why you changed the recommendation — stored on the audit trail."
            className={cn(
              'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
          />
        </div>

        {changedFromRecommendation ? (
          <Alert tone="info">
            You are overriding the AI recommendation. The change is recorded against
            this complaint.
          </Alert>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={() => void handleAssign()}
            loading={saving}
            disabled={!assigneeId && !departmentId}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {assigneeId ? 'Assign & route' : 'Save routing'}
          </Button>

          {recommendation && changedFromRecommendation ? (
            <Button
              type="button"
              variant="secondary"
              onClick={resetToRecommendation}
              disabled={saving}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Reset to recommendation
            </Button>
          ) : null}
        </div>

        {!assigneeId && !departmentId ? (
          <p className="text-xs text-slate-500">
            Pick a department or a staff member to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}
