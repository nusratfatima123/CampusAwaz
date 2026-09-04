'use client';

import { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceMeter, confidenceLabel } from '@/components/ui/ConfidenceMeter';
import type { PrivacyMode } from '@/types/database';

export interface AiRecommendation {
  category_key: string;
  category_label: string;
  priority: string;
  department_key: string;
  department_name: string;
  confidence: {
    category: number;
    priority: number;
    department: number;
    overall: number;
  };
}

export interface AiGeneratedDraft {
  title: string;
  description: string;
  who?: string;
  what: string;
  when?: string;
  where?: string;
  impact: string;
  requested_action: string;
}

export interface AiAssistantProps {
  description: string;
  privacyMode: PrivacyMode;
  onApplyRecommendation?: (rec: AiRecommendation) => void;
  onApplyDraft?: (draft: AiGeneratedDraft) => void;
}

export function AiAssistant({
  description,
  privacyMode,
  onApplyRecommendation,
  onApplyDraft,
}: AiAssistantProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null);
  const [draft, setDraft] = useState<AiGeneratedDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  async function handleAnalyze() {
    if (!description.trim()) {
      setError('Please describe your complaint first.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setRecommendation(null);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          privacyMode,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'AI analysis failed. Please try again.');
        return;
      }

      if (!payload.success || !payload.recommendation) {
        setError('AI did not return a recommendation.');
        return;
      }

      setRecommendation(payload.recommendation);
      setDegraded(payload.degraded ?? false);

      if (onApplyRecommendation) {
        onApplyRecommendation(payload.recommendation);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!description.trim() || !recommendation) {
      setError('Please analyze your complaint first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setDraft(null);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          categoryKey: recommendation.category_key,
          priority: recommendation.priority,
          privacyMode,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'AI generation failed. Please try again.');
        return;
      }

      if (!payload.success || !payload.draft) {
        setError('AI did not return a draft.');
        return;
      }

      setDraft(payload.draft);

      if (onApplyDraft) {
        onApplyDraft(payload.draft);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  const identityStripped = privacyMode === 'anonymous' || privacyMode === 'confidential';

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
          <Sparkles className="h-5 w-5 text-blue-900" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900">CampusAwaz AI Assistant</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Describe your complaint in your own words, then let the assistant suggest the
            right category, priority, and department. You can edit everything before submitting.
          </p>

          {identityStripped ? (
            <Alert tone="info" className="mt-3">
              Your identity details are removed before AI analysis because you chose{' '}
              {privacyMode === 'anonymous' ? 'Anonymous' : 'Confidential'} reporting.
            </Alert>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAnalyze}
          disabled={analyzing || !description.trim()}
          loading={analyzing}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Analyze with AI
            </>
          )}
        </Button>

        {recommendation ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            loading={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Generate structured complaint
              </>
            )}
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {degraded && recommendation ? (
        <Alert tone="warning" className="mt-4">
          The AI service was unavailable, so the assistant used a rule-based fallback. The
          recommendation is still usable, but please review it carefully.
        </Alert>
      ) : null}

      {recommendation ? (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900">AI recommendation</span>
            <Badge tone={recommendation.confidence.overall < 0.7 ? 'warning' : 'success'}>
              {confidenceLabel(recommendation.confidence.overall)}
            </Badge>
          </div>

          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Category
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {recommendation.category_label}
              </dd>
              <dd className="mt-2">
                <ConfidenceMeter
                  label="Category"
                  value={recommendation.confidence.category}
                />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Priority
              </dt>
              <dd className="mt-1">
                <Badge
                  tone={
                    recommendation.priority === 'critical'
                      ? 'danger'
                      : recommendation.priority === 'high'
                        ? 'warning'
                        : recommendation.priority === 'low'
                          ? 'neutral'
                          : 'info'
                  }
                >
                  {recommendation.priority}
                </Badge>
              </dd>
              <dd className="mt-2">
                <ConfidenceMeter
                  label="Priority"
                  value={recommendation.confidence.priority}
                />
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Department
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {recommendation.department_name}
              </dd>
              <dd className="mt-2">
                <ConfidenceMeter
                  label="Department"
                  value={recommendation.confidence.department}
                />
              </dd>
            </div>
          </dl>

          <div className="border-t border-blue-200 pt-3">
            <ConfidenceMeter
              label="Overall confidence"
              value={recommendation.confidence.overall}
            />
          </div>

          <p className="text-xs text-slate-500">
            The assistant&apos;s suggestion is advisory. You can adjust your description
            before continuing to the next step.
          </p>
        </div>
      ) : null}

      {draft ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900">
              Structured complaint draft
            </span>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div>
              <span className="font-semibold text-slate-900">Title: </span>
              <span className="text-slate-700">{draft.title}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">What happened: </span>
              <span className="text-slate-700">{draft.what}</span>
            </div>
            {draft.who ? (
              <div>
                <span className="font-semibold text-slate-900">Who was involved: </span>
                <span className="text-slate-700">{draft.who}</span>
              </div>
            ) : null}
            {draft.when ? (
              <div>
                <span className="font-semibold text-slate-900">When: </span>
                <span className="text-slate-700">{draft.when}</span>
              </div>
            ) : null}
            {draft.where ? (
              <div>
                <span className="font-semibold text-slate-900">Where: </span>
                <span className="text-slate-700">{draft.where}</span>
              </div>
            ) : null}
            <div>
              <span className="font-semibold text-slate-900">Impact: </span>
              <span className="text-slate-700">{draft.impact}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">Requested action: </span>
              <span className="text-slate-700">{draft.requested_action}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            This draft has been applied to your form. You can edit the title and
            description before submitting.
          </p>
        </div>
      ) : null}
    </div>
  );
}
