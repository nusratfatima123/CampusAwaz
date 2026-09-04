'use client';

import { useState, useRef } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';

interface ResolutionFormProps {
  trackingId: string;
  onSuccess: () => void;
}

export function ResolutionForm({ trackingId, onSuccess }: ResolutionFormProps) {
  const [actionTaken, setActionTaken] = useState('');
  const [explanation, setExplanation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (actionTaken.trim().length < 10) {
      setError('Please describe the action taken in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file, idx) => {
          formData.append(idx === 0 ? 'file' : `file${idx + 1}`, file);
        });

        const uploadRes = await fetch(
          `/api/complaints/admin/${trackingId}/resolution/evidence/upload`,
          { method: 'POST', body: formData },
        );
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error ?? 'Failed to upload evidence files.');
      }

      const res = await fetch(`/api/complaints/admin/${trackingId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionTaken: actionTaken.trim(),
          resolutionExplanation: explanation.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to resolve complaint');

      setActionTaken('');
      setExplanation('');
      setFiles([]);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve complaint.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <FileText className="h-5 w-5 text-blue-900" aria-hidden="true" />
        Resolve Complaint
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Record the action taken and optionally attach evidence files. This will
        transition the complaint to <strong>Resolved</strong>.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="action-taken"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Action taken <span className="text-red-500">*</span>
          </label>
          <textarea
            id="action-taken"
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the corrective action that was taken..."
            required
          />
        </div>

        <div>
          <label
            htmlFor="resolution-explanation"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Resolution explanation (optional)
          </label>
          <textarea
            id="resolution-explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional context about the resolution..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Evidence files (optional, max 5)
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 5}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Attach files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="text-xs text-slate-500">
              {files.length}/5 files
            </span>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="truncate text-slate-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-2 shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button
          type="submit"
          variant="primary"
          disabled={actionTaken.trim().length < 10 || submitting}
          loading={submitting}
        >
          {submitting ? 'Resolving...' : 'Resolve Complaint'}
        </Button>
      </form>
    </Card>
  );
}
