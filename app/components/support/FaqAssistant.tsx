'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { FAQ_INPUT_MIN, FAQ_INPUT_MAX } from '@/lib/constants';

interface FaqSource {
  id: string;
  question: string;
  answer: string;
}

export function FaqAssistant() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    answer: string;
    sources: FaqSource[];
    confidence: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < FAQ_INPUT_MIN) {
      setError(`Please enter at least ${FAQ_INPUT_MIN} characters.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/faq/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to get answer.');
      setResult({
        answer: json.answer,
        sources: json.sources ?? [],
        confidence: json.confidence ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate answer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="faq-query"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Ask a question about university policies or FAQs
            </label>
            <textarea
              id="faq-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              minLength={FAQ_INPUT_MIN}
              maxLength={FAQ_INPUT_MAX}
              placeholder="e.g. How do I file a complaint about hostel facilities?"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {query.length}/{FAQ_INPUT_MAX} characters (min {FAQ_INPUT_MIN})
            </p>
          </div>
          <Button type="submit" loading={loading} disabled={query.trim().length < FAQ_INPUT_MIN}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Get Answer
          </Button>
        </form>
      </Card>

      {error && (
        <Alert tone="error" title="Error">
          {error}
        </Alert>
      )}

      {loading && (
        <Card className="flex items-center gap-3 py-6">
          <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
          <p className="text-sm text-slate-600">Searching approved resources...</p>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Answer</h3>
              <ConfidenceMeter label="Confidence" value={result.confidence} />
            </div>
            <div className="prose prose-sm max-w-none text-slate-700">
              {result.answer.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </Card>

          <Alert tone="info">
            This answer is based solely on approved university content. For further
            assistance, contact the support office.
          </Alert>

          {result.sources.length > 0 && (
            <Card>
              <h3 className="mb-3 text-base font-bold text-slate-900">Sources</h3>
              <div className="space-y-3">
                {result.sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {source.question}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{source.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
