'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IntakeTable } from './IntakeTable';
import { RoutingPanel } from './RoutingPanel';
import type { AssignableStaff, IntakeItem } from '@/lib/routing';
import type { ComplaintCategory, Department } from '@/types/database';

export interface IntakeWorkspaceProps {
  items: IntakeItem[];
  departments: Pick<Department, 'id' | 'key' | 'name'>[];
  staff: AssignableStaff[];
  categories: Pick<ComplaintCategory, 'id' | 'key' | 'label' | 'is_sensitive'>[];
}

/**
 * Client shell that pairs the intake queue with the routing panel.
 *
 * All data arrives pre-filtered from the server page (which already applied the
 * role and sensitive-case checks), so this component only manages selection and
 * refreshes after a decision is applied.
 */
export function IntakeWorkspace({
  items,
  departments,
  staff,
  categories,
}: IntakeWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(
    items[0]?.trackingId ?? null
  );

  const selected =
    items.find((item) => item.trackingId === selectedTrackingId) ?? null;

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {items.length === 0
            ? 'No complaints are waiting for a decision.'
            : `${items.length} complaint${items.length === 1 ? '' : 's'} awaiting review.`}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={refresh}
          loading={pending}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <IntakeTable
          items={items}
          selectedTrackingId={selectedTrackingId}
          onSelect={setSelectedTrackingId}
        />

        {items.length > 0 ? (
          <Card className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            {selected ? (
              <RoutingPanel
                key={selected.trackingId}
                item={selected}
                departments={departments}
                staff={staff}
                categories={categories}
                onApplied={refresh}
              />
            ) : (
              <div className="py-10 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  Select a complaint
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                  Choose a row from the queue to see its description and the AI
                  recommendation.
                </p>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
