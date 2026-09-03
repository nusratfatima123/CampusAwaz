'use client';

import {
  AlertTriangle,
  FileText,
  Paperclip,
  Pencil,
  Send,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { formatBytes } from '@/lib/validators';
import { PRIVACY_PRESENTATION } from '@/lib/complaint-ui';
import type { PrivacyMode } from '@/types/database';

export interface ComplaintReviewData {
  categoryLabel: string;
  title: string;
  description: string;
  privacyMode: PrivacyMode;
  files: File[];
  immediateDanger?: boolean;
  isSensitive?: boolean;
}

/** Final read-back before submission, with inline "edit" jumps per section. */
export function ComplaintReview({
  data,
  onEdit,
  onSubmit,
  submitting,
  error,
}: {
  data: ComplaintReviewData;
  onEdit: (step: 'describe' | 'privacy' | 'evidence') => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const privacy = PRIVACY_PRESENTATION[data.privacyMode];

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error" title="Could not submit">
          {error}
        </Alert>
      ) : null}

      {data.immediateDanger ? (
        <Alert tone="error" title="Marked as immediate danger">
          This report is flagged for urgent attention. If you are in danger right now,
          contact campus security or local emergency services as well.
        </Alert>
      ) : null}

      {/* Category + description */}
      <Section
        title="What happened"
        onEdit={() => onEdit('describe')}
        editLabel="Edit description"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" icon={<Tag className="h-3.5 w-3.5" />}>
            {data.categoryLabel}
          </Badge>
          {data.isSensitive ? (
            <Badge tone="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
              Protected case
            </Badge>
          ) : null}
        </div>

        <p className="mt-4 text-base font-semibold text-slate-900">{data.title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {data.description}
        </p>
      </Section>

      {/* Privacy */}
      <Section
        title="Privacy"
        onEdit={() => onEdit('privacy')}
        editLabel="Edit privacy mode"
      >
        <Badge tone={privacy.tone}>{privacy.label}</Badge>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{privacy.detail}</p>
      </Section>

      {/* Evidence */}
      <Section
        title={`Evidence (${data.files.length})`}
        onEdit={() => onEdit('evidence')}
        editLabel="Edit evidence"
      >
        {data.files.length === 0 ? (
          <p className="text-sm text-slate-500">No files attached.</p>
        ) : (
          <ul className="space-y-2">
            {data.files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-gray-50 px-4 py-3"
              >
                {file.type === 'application/pdf' ? (
                  <FileText
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Paperclip
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatBytes(file.size)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="rounded-2xl border border-slate-200 bg-gray-50 p-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Submitting creates a permanent record with a unique tracking ID. Filing a
          knowingly false report is a violation of university policy.
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        fullWidth
        loading={submitting}
        onClick={onSubmit}
      >
        {submitting ? 'Submitting…' : 'Submit complaint'}
        {!submitting ? <Send className="h-4 w-4" aria-hidden="true" /> : null}
      </Button>
    </div>
  );
}

function Section({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-blue-900 transition hover:bg-blue-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{editLabel}</span>
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
