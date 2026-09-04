import { ExternalLink, FileText } from 'lucide-react';
import { formatBytes } from '@/lib/validators';
import type { SignedEvidence } from '@/lib/complaints';

/**
 * Evidence thumbnails backed by 1-hour signed URLs.
 * PDFs render as a file tile because the bucket is private and cannot be framed
 * without a signed link, which we surface as an explicit "Open" action.
 */
export function EvidenceGallery({ evidence }: { evidence: SignedEvidence[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-slate-500">No evidence was attached.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {evidence.map((item) => {
        const isImage = item.fileType.startsWith('image/');

        return (
          <li
            key={item.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex h-36 items-center justify-center bg-gray-50">
              {isImage && item.url ? (
                /* eslint-disable-next-line @next/next/no-img-element -- private object behind a signed URL */
                <img
                  src={item.url}
                  alt={item.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileText className="h-10 w-10 text-slate-300" aria-hidden="true" />
              )}
            </div>

            <div className="p-4">
              <p className="truncate text-sm font-semibold text-slate-900">
                {item.fileName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatBytes(item.fileSizeBytes)} ·{' '}
                {isImage ? 'Image' : item.fileType === 'application/pdf' ? 'PDF' : 'File'}
              </p>

              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 underline hover:text-blue-800"
                >
                  Open
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-3 text-xs text-amber-600">
                  Preview link unavailable — reload the page to retry.
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
