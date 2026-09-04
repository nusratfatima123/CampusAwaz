'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { OcrPreview, type OcrFields } from './OcrPreview';
import { validateCardFile, formatBytes } from '@/lib/validators';
import {
  ALLOWED_CARD_MIME_TYPES,
  MAX_CARD_FILE_BYTES,
} from '@/lib/constants';
import { cn } from '@/lib/cn';

interface UploadResult {
  ocr: OcrFields;
  threshold: number;
  needsManualReview: boolean;
  previewUrl: string | null;
}

export function CardUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function selectFile(candidate: File) {
    setError(null);
    setResult(null);

    const check = validateCardFile({
      type: candidate.type,
      size: candidate.size,
      name: candidate.name,
    });

    if (!check.valid) {
      setError(check.error ?? 'This file cannot be used.');
      setFile(null);
      setLocalPreview(null);
      return;
    }

    setFile(candidate);

    // Local thumbnail for images only.
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(
      candidate.type.startsWith('image/') ? URL.createObjectURL(candidate) : null
    );
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  function clearFile() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setFile(null);
    setLocalPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/verify/card', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        threshold?: number;
        needs_manual_review?: boolean;
        preview_url?: string | null;
        ocr?: OcrFields;
      };

      if (!response.ok || !payload.success || !payload.ocr) {
        setError(payload.error ?? 'Upload failed. Please try again.');
        return;
      }

      setResult({
        ocr: payload.ocr,
        threshold: payload.threshold ?? 0.75,
        needsManualReview: Boolean(payload.needs_manual_review),
        previewUrl: payload.preview_url ?? null,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleConfirm() {
    setConfirmed(true);
    router.refresh();
    setTimeout(() => router.push('/verify'), 900);
  }

  const acceptAttr = ALLOWED_CARD_MIME_TYPES.join(',');
  const isPdf = file?.type === 'application/pdf';

  // ------------------------------------------------------------- confirmed
  if (confirmed) {
    return (
      <Alert tone="success" title="Details confirmed">
        Your student card has been saved. Redirecting to your verification
        summary…
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error" title="Upload problem">
          {error}
        </Alert>
      ) : null}

      {/* ------------------------------------------------------ drop zone */}
      {!result ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'rounded-2xl border-2 border-dashed p-8 text-center transition',
              dragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-slate-300 bg-gray-50 hover:border-slate-400'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttr}
              className="sr-only"
              id="student-card-input"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) selectFile(chosen);
              }}
            />

            <span
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm"
              aria-hidden="true"
            >
              <UploadCloud className="h-7 w-7 text-blue-900" />
            </span>

            <p className="text-base font-semibold text-slate-900">
              Drag and drop your student card
            </p>
            <p className="mt-1 text-sm text-slate-600">
              or{' '}
              <label
                htmlFor="student-card-input"
                className="cursor-pointer rounded font-semibold text-blue-900 underline hover:text-blue-800"
              >
                browse your files
              </label>
            </p>
            <p className="mt-4 text-xs text-slate-500">
              JPG, PNG, WEBP or PDF · up to {formatBytes(MAX_CARD_FILE_BYTES)}
            </p>
          </div>

          {/* Selected file */}
          {file ? (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              {localPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element -- local blob preview */
                <img
                  src={localPreview}
                  alt="Selected student card preview"
                  className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100"
                  aria-hidden="true"
                >
                  <FileText className="h-7 w-7 text-slate-500" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatBytes(file.size)} · {isPdf ? 'PDF' : 'Image'}
                </p>
              </div>

              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove selected file"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <Button
            type="button"
            size="lg"
            fullWidth
            disabled={!file}
            loading={uploading}
            onClick={() => void handleUpload()}
          >
            {uploading ? 'Scanning document…' : 'Upload and scan'}
            {!uploading ? (
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </Button>
        </>
      ) : null}

      {/* --------------------------------------------------- OCR results */}
      {result ? (
        <>
          <OcrPreview
            fields={result.ocr}
            threshold={result.threshold}
            needsManualReview={result.needsManualReview}
            previewUrl={result.previewUrl ?? localPreview}
            fileName={file?.name}
            isPdf={isPdf}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" onClick={handleConfirm}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm details
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={clearFile}
            >
              Upload a different file
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
