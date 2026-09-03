'use client';

import { useRef, useState } from 'react';
import { FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { cn } from '@/lib/cn';
import { formatBytes, validateEvidenceFile } from '@/lib/validators';
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_BYTES,
  MAX_EVIDENCE_FILES,
} from '@/lib/constants';

/**
 * Drag-and-drop evidence picker.
 *
 * Files are held in memory and uploaded only when the complaint is submitted, so
 * abandoning the form leaves nothing behind in Storage. The same MIME/size/count
 * rules are re-applied server-side — this is a UX affordance, not the guard.
 */
export function EvidenceUploader({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const candidates = Array.from(incoming);
    const accepted: File[] = [];

    for (const candidate of candidates) {
      if (files.length + accepted.length >= MAX_EVIDENCE_FILES) {
        setError(
          `You can attach at most ${MAX_EVIDENCE_FILES} files. Extra files were ignored.`
        );
        break;
      }

      const check = validateEvidenceFile({
        type: candidate.type,
        size: candidate.size,
        name: candidate.name,
      });
      if (!check.valid) {
        setError(check.error ?? 'This file cannot be used.');
        continue;
      }

      const duplicate = [...files, ...accepted].some(
        (f) => f.name === candidate.name && f.size === candidate.size
      );
      if (duplicate) {
        setError(`"${candidate.name}" is already attached.`);
        continue;
      }

      accepted.push(candidate);
    }

    if (accepted.length > 0) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(index: number) {
    setError(null);
    onChange(files.filter((_, i) => i !== index));
  }

  const full = files.length >= MAX_EVIDENCE_FILES;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="error" title="Attachment problem">
          {error}
        </Alert>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled || full) return;
          if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed p-8 text-center transition',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 bg-gray-50 hover:border-slate-400',
          (disabled || full) && 'opacity-60'
        )}
      >
        <input
          ref={inputRef}
          id="evidence-input"
          type="file"
          multiple
          accept={ALLOWED_EVIDENCE_MIME_TYPES.join(',')}
          className="sr-only"
          disabled={disabled || full}
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
          }}
        />

        <span
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm"
          aria-hidden="true"
        >
          <UploadCloud className="h-7 w-7 text-blue-900" />
        </span>

        <p className="text-base font-semibold text-slate-900">
          {full ? 'Attachment limit reached' : 'Drag and drop your evidence'}
        </p>
        {!full ? (
          <p className="mt-1 text-sm text-slate-600">
            or{' '}
            <label
              htmlFor="evidence-input"
              className="cursor-pointer rounded font-semibold text-blue-900 underline hover:text-blue-800"
            >
              browse your files
            </label>
          </p>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">
          JPG, PNG, WEBP or PDF · up to {formatBytes(MAX_EVIDENCE_FILE_BYTES)} each ·
          max {MAX_EVIDENCE_FILES} files
        </p>
      </div>

      {files.length > 0 ? (
        <ul className="space-y-3">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100"
                aria-hidden="true"
              >
                {file.type === 'application/pdf' ? (
                  <FileText className="h-5 w-5 text-slate-500" />
                ) : (
                  <Paperclip className="h-5 w-5 text-slate-500" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatBytes(file.size)} ·{' '}
                  {file.type === 'application/pdf' ? 'PDF' : 'Image'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          Evidence is optional, but screenshots, letters or photos make a case much
          easier to act on.
        </p>
      )}
    </div>
  );
}
