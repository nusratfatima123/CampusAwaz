'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Stepper } from '@/components/ui/Stepper';
import { PrivacySelector } from './PrivacySelector';
import { EvidenceUploader } from './EvidenceUploader';
import { ComplaintReview } from './ComplaintReview';
import { AiAssistant } from './AiAssistant';
import {
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_FORM_STEPS,
} from '@/lib/constants';
import {
  validateComplaintDescription,
  validateComplaintTitle,
} from '@/lib/validators';
import { cn } from '@/lib/cn';
import type { PrivacyMode } from '@/types/database';

export interface ComplaintFormProps {
  categoryId: string;
  categoryKey: string;
  categoryLabel: string;
  categoryDescription?: string | null;
  isSensitive?: boolean;
  /** Privacy mode pre-selected when the form opens. */
  defaultPrivacyMode?: PrivacyMode;
  /** Mode highlighted as recommended in the selector. */
  recommendedPrivacyMode?: PrivacyMode;
  /** Renders the immediate-danger toggle (safety flow only). */
  showImmediateDanger?: boolean;
  descriptionPrompt?: string;
  descriptionPlaceholder?: string;
}

type StepKey = 'describe' | 'privacy' | 'evidence' | 'review';

const STEP_ORDER: StepKey[] = ['describe', 'privacy', 'evidence', 'review'];

/**
 * Multi-step complaint composer shared by the standard and the safety flows.
 *
 * Everything is submitted in one multipart request to `/api/complaints`, which
 * re-validates each field and each file with the service-role client.
 */
export function ComplaintForm({
  categoryId,
  categoryKey,
  categoryLabel,
  categoryDescription,
  isSensitive = false,
  defaultPrivacyMode = 'identified',
  recommendedPrivacyMode,
  showImmediateDanger = false,
  descriptionPrompt = 'Describe what happened',
  descriptionPlaceholder = 'Explain the problem in your own words — what happened, when, where, and who was involved.',
}: ComplaintFormProps) {
  const router = useRouter();

  const [step, setStep] = useState<StepKey>('describe');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(defaultPrivacyMode);
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goNext() {
    if (step === 'describe') {
      const t = validateComplaintTitle(title);
      const d = validateComplaintDescription(description);
      setTitleError(t.valid ? null : (t.error ?? null));
      setDescriptionError(d.valid ? null : (d.error ?? null));
      if (!t.valid || !d.valid) return;
    }
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const previous = STEP_ORDER[stepIndex - 1];
    if (previous) setStep(previous);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.append('category_id', categoryId);
      body.append('title', title.trim());
      body.append('description', description.trim());
      body.append('privacy_mode', privacyMode);
      body.append('immediate_danger', String(Boolean(immediateDanger)));
      files.forEach((file) => body.append('evidence', file));

      const response = await fetch('/api/complaints', { method: 'POST', body });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        tracking_id?: string;
      };

      if (!response.ok || !payload.success || !payload.tracking_id) {
        setSubmitError(payload.error ?? 'Could not submit your complaint.');
        return;
      }

      router.push(
        `/complaints/success?trackingId=${encodeURIComponent(payload.tracking_id)}`
      );
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = COMPLAINT_DESCRIPTION_MAX - description.length;

  return (
    <div className="space-y-6">
      <Stepper
        items={COMPLAINT_FORM_STEPS.map((label, index) => ({
          label,
          complete: index < stepIndex,
        }))}
        currentIndex={stepIndex}
      />

      <Card>
        {/* ------------------------------------------------ 1. Describe */}
        {step === 'describe' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {descriptionPrompt}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {categoryDescription ??
                  'Write freely — there is no form to fill in, just tell us what went wrong.'}
              </p>
            </div>

            <Input
              label="Short summary"
              required
              value={title}
              maxLength={140}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              error={titleError}
              placeholder="e.g. Lab equipment has been broken for three weeks"
            />

            <div>
              <label
                htmlFor="complaint-description"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Full description
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="complaint-description"
                rows={9}
                value={description}
                maxLength={COMPLAINT_DESCRIPTION_MAX}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (descriptionError) setDescriptionError(null);
                }}
                aria-invalid={descriptionError ? true : undefined}
                placeholder={descriptionPlaceholder}
                className={cn(
                  'w-full rounded-xl border bg-white px-4 py-3 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2',
                  descriptionError
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
                    : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500'
                )}
              />
              <div className="mt-2 flex items-start justify-between gap-4">
                {descriptionError ? (
                  <p role="alert" className="text-sm font-medium text-red-600">
                    {descriptionError}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Include dates, locations and names where you can.
                  </p>
                )}
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    remaining < 200 ? 'text-amber-600' : 'text-slate-400'
                  )}
                >
                  {remaining} left
                </span>
              </div>
            </div>

            {showImmediateDanger ? (
              <div
                className={cn(
                  'rounded-2xl border-2 p-5 transition',
                  immediateDanger
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-gray-50'
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={immediateDanger}
                    onChange={(event) => setImmediateDanger(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <ShieldAlert
                        className="h-4 w-4 text-red-600"
                        aria-hidden="true"
                      />
                      I am in immediate danger
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-slate-600">
                      Flags this report as critical so the protected safety desk sees
                      it first.
                    </span>
                  </span>
                </label>

                {immediateDanger ? (
                  <Alert tone="error" title="If you are unsafe right now" className="mt-4">
                    Do not wait for this report. Contact campus security or your local
                    emergency number immediately, then move to a safe place.
                  </Alert>
                ) : null}
              </div>
            ) : null}

            <AiAssistant
              description={description}
              privacyMode={privacyMode}
              onApplyRecommendation={() => {
                // Placeholder: in a full implementation, this would update
                // category/priority/department state. For Sprint 3, the AI
                // recommendation is advisory and the student reviews it manually.
              }}
              onApplyDraft={() => {
                // Placeholder: in a full implementation, this would populate
                // the title/description fields from the AI draft.
              }}
            />
          </div>
        ) : null}

        {/* ------------------------------------------------- 2. Privacy */}
        {step === 'privacy' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                How should we handle your identity?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can always see your own complaint. This choice controls what the
                staff handling it can see.
              </p>
            </div>

            <PrivacySelector
              value={privacyMode}
              onChange={setPrivacyMode}
              recommended={recommendedPrivacyMode}
            />
          </div>
        ) : null}

        {/* ------------------------------------------------ 3. Evidence */}
        {step === 'evidence' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Attach evidence</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Optional. Files are stored in a private bucket and are only reachable
                through short-lived signed links.
              </p>
            </div>

            <EvidenceUploader files={files} onChange={setFiles} disabled={submitting} />
          </div>
        ) : null}

        {/* -------------------------------------------------- 4. Review */}
        {step === 'review' ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Review before you submit
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Check every section. You will get a tracking ID as soon as this is
                filed.
              </p>
            </div>

            <ComplaintReview
              data={{
                categoryLabel,
                title,
                description,
                privacyMode,
                files,
                immediateDanger,
                isSensitive,
              }}
              onEdit={(target) => setStep(target)}
              onSubmit={() => void handleSubmit()}
              submitting={submitting}
              error={submitError}
            />
          </div>
        ) : null}

        {/* Navigation (review has its own submit button) */}
        {step !== 'review' ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                stepIndex === 0 ? router.push('/complaints/new') : goBack()
              }
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {stepIndex === 0 ? 'Change category' : 'Back'}
            </Button>

            <Button type="button" onClick={goNext}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <Button type="button" variant="secondary" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to evidence
            </Button>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-slate-400">
        Category: {categoryLabel} ({categoryKey})
      </p>
    </div>
  );
}
