import { Badge } from '@/components/ui/Badge';
import type { SlaDisplay } from '@/types/database';

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SlaIndicator({ sla }: { sla: SlaDisplay | null }) {
  if (!sla) return null;

  if (sla.state === 'breached') {
    return (
      <div className="space-y-1">
        <Badge tone="danger">SLA breached</Badge>
        <p className="text-xs text-slate-500">
          Deadline: {sla.responseHours}h — {formatDeadline(sla.responseDeadline)}
        </p>
      </div>
    );
  }

  if (sla.state === 'approaching') {
    return (
      <div className="space-y-1">
        <Badge tone="warning">
          SLA: {Math.round(sla.hoursRemaining)}h left
        </Badge>
        <p className="text-xs text-slate-500">
          Deadline: {sla.responseHours}h — {formatDeadline(sla.responseDeadline)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Badge tone="success">
        SLA: {Math.round(sla.hoursRemaining)}h remaining
      </Badge>
      <p className="text-xs text-slate-500">
        Deadline: {sla.responseHours}h — {formatDeadline(sla.responseDeadline)}
      </p>
    </div>
  );
}

export function SlaDot({ state }: { state: string | null }) {
  if (!state) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-200" aria-label="No SLA" />;

  const colors: Record<string, string> = {
    on_track: 'bg-green-500',
    approaching: 'bg-amber-500',
    breached: 'bg-red-500',
  };

  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[state] ?? 'bg-slate-200'}`}
      aria-label={`SLA: ${state.replace('_', ' ')}`}
    />
  );
}
