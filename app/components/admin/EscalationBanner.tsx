'use client';

import { AlertTriangle, ArrowUpRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { formatComplaintDateTime } from '@/lib/complaint-ui';
import { cn } from '@/lib/cn';

export interface EscalationEntry {
  id: string;
  escalated_by: string | null;
  escalated_to: string | null;
  reason: string;
  previous_status: string | null;
  new_status: string;
  level: number;
  created_at: string;
}

interface EscalationBannerProps {
  escalations: EscalationEntry[];
}

export function EscalationBanner({ escalations }: EscalationBannerProps) {
  if (escalations.length === 0) return null;

  const latest = escalations[escalations.length - 1];
  if (!latest) return null;

  return (
    <Card className="border-red-200 bg-red-50/50">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-red-900">
              Escalated (Level {latest.level})
            </h3>
            <Badge tone="danger">Active</Badge>
          </div>
          <p className="mt-1 text-sm text-red-800">
            This complaint has been escalated {escalations.length === 1 ? 'once' : `${escalations.length} times`}.
            The most recent escalation was on {formatComplaintDateTime(latest.created_at)}.
          </p>
        </div>
      </div>

      {escalations.length > 0 && (
        <div className="mt-5 border-t border-red-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-red-900">
            Escalation history
          </h4>
          <ol className="relative space-y-4 pl-7">
            <span
              aria-hidden="true"
              className="absolute left-[10px] top-1 h-[calc(100%-0.5rem)] w-0.5 rounded-full bg-red-200"
            />
            {escalations.map((esc, idx) => (
              <li key={esc.id} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -left-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white',
                    idx === escalations.length - 1
                      ? 'bg-red-600 text-white'
                      : 'bg-red-300 text-red-800',
                  )}
                >
                  <ArrowUpRight className="h-3 w-3" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-900">
                    Level {esc.level}
                  </span>
                  <span className="text-xs text-red-600">
                    {formatComplaintDateTime(esc.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-red-800">
                  {esc.reason}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
