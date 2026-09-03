'use client';

import {
  Heart,
  Shield,
  FileText,
  HelpCircle,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { SUPPORT_RESOURCE_LABELS } from '@/lib/constants';
import type { SupportResource, SupportResourceType } from '@/types/database';

const TYPE_ICONS: Record<SupportResourceType, typeof Heart> = {
  mental_health: Heart,
  student_rights: Shield,
  policy: FileText,
  faq: HelpCircle,
  emergency: Phone,
  general: FileText,
};

const TYPE_COLORS: Record<SupportResourceType, string> = {
  mental_health: 'bg-pink-100 text-pink-700',
  student_rights: 'bg-blue-100 text-blue-700',
  policy: 'bg-slate-100 text-slate-700',
  faq: 'bg-green-100 text-green-700',
  emergency: 'bg-red-100 text-red-700',
  general: 'bg-slate-100 text-slate-700',
};

export function ResourceCard({ resource }: { resource: SupportResource }) {
  const Icon = TYPE_ICONS[resource.resource_type] ?? FileText;
  const colorClass = TYPE_COLORS[resource.resource_type] ?? TYPE_COLORS.general;
  const label =
    SUPPORT_RESOURCE_LABELS[resource.resource_type] ?? resource.resource_type;

  return (
    <Card className="flex gap-4 p-5">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          colorClass,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            {resource.title}
          </h3>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {label}
          </span>
        </div>
        {resource.description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {resource.description}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 transition hover:text-blue-800"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Visit resource
            </a>
          ) : null}
          {resource.phone ? (
            <a
              href={`tel:${resource.phone}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 transition hover:text-blue-800"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {resource.phone}
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
