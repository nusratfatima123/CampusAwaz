'use client';

import { useState } from 'react';
import { FileText, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { AUTHORITY_REQUESTABLE_ROLES, roleLabel } from '@/lib/roles';
import { cn } from '@/lib/cn';
import type { RoleName } from '@/types/database';

const STATEMENT_MIN = 50;
const STATEMENT_MAX = 2000;

export interface AuthorityRequestFormProps {
  departments?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function AuthorityRequestForm({
  departments,
  onSuccess,
}: AuthorityRequestFormProps) {
  const [roleName, setRoleName] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [statement, setStatement] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const charCount = statement.length;
  const charValid = charCount >= STATEMENT_MIN && charCount <= STATEMENT_MAX;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!roleName) {
      setError('Please select a role.');
      return;
    }
    if (!charValid) {
      setError(`Statement must be between ${STATEMENT_MIN} and ${STATEMENT_MAX} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      let evidencePath: string | null = null;

      if (evidenceFile) {
        const formData = new FormData();
        formData.append('file', evidenceFile);
        formData.append('kind', 'authority_evidence');

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const json = await uploadRes.json().catch(() => ({}));
          throw new Error(json.error ?? 'Evidence upload failed.');
        }
        const uploadJson = await uploadRes.json();
        evidencePath = uploadJson.path ?? null;
      }

      const res = await fetch('/api/authority/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleName,
          departmentId: departmentId || null,
          statement,
          evidencePath,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request.');

      setSuccess(true);
      setRoleName('');
      setDepartmentId('');
      setStatement('');
      setEvidenceFile(null);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Alert tone="success" title="Request submitted">
        Your authority request has been submitted and is pending admin review. You
        will be notified when a decision is made.
        <button
          type="button"
          className="mt-2 text-sm font-semibold underline"
          onClick={() => setSuccess(false)}
        >
          Submit another request
        </button>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-8 w-8 text-blue-900" aria-hidden="true" />}
        title="Request Authority Role"
        description="Submit a request to serve in a university authority position. Your request will be reviewed by an administrator."
      />

      {error ? (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-slate-800">
            Select role <span className="text-red-600">*</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUTHORITY_REQUESTABLE_ROLES.map((role) => {
              const selected = roleName === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleName(role)}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition',
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {roleLabel(role)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {departments && departments.length > 0 ? (
          <div>
            <label
              htmlFor="department"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Department
            </label>
            <select
              id="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No specific department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="statement"
            className="mb-2 block text-sm font-medium text-slate-800"
          >
            Why should you hold this role?{' '}
            <span className="text-red-600">*</span>
          </label>
          <textarea
            id="statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={5}
            maxLength={STATEMENT_MAX + 100}
            placeholder="Describe your qualifications, experience, and motivation for this role (minimum 50 characters)..."
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2',
              charValid || charCount === 0
                ? 'border-slate-200 focus:border-blue-400 focus:ring-blue-500'
                : 'border-red-300 focus:border-red-400 focus:ring-red-400'
            )}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span
              className={cn(
                'font-medium',
                charCount === 0
                  ? 'text-slate-400'
                  : charValid
                    ? 'text-green-600'
                    : 'text-red-600'
              )}
            >
              {charCount} / {STATEMENT_MAX} characters
              {charCount > 0 && charCount < STATEMENT_MIN
                ? ` (minimum ${STATEMENT_MIN})`
                : ''}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800">
            Supporting document (optional)
          </label>
          <label
            htmlFor="evidence-upload"
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition',
              evidenceFile
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            {evidenceFile ? (
              <FileText className="h-5 w-5 text-blue-700" aria-hidden="true" />
            ) : (
              <Upload className="h-5 w-5 text-slate-400" aria-hidden="true" />
            )}
            <span className="text-sm text-slate-600">
              {evidenceFile ? evidenceFile.name : 'Click to upload a supporting document'}
            </span>
            <input
              id="evidence-upload"
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <Button type="submit" loading={submitting} fullWidth>
          Submit Request
        </Button>
      </form>
    </Card>
  );
}
