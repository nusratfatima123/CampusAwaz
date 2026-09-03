'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { StatusSelector } from './StatusSelector';
import { createClient } from '@/lib/supabase/client';
import type { StudentType } from '@/types/database';

/**
 * Client wrapper for the standalone /verify/status screen.
 *
 * Persists `profiles.student_type` and records the
 * `verification.status.selected` audit event.
 */
export function StatusStep({
  initialStudentType,
}: {
  initialStudentType: StudentType | null;
}) {
  const router = useRouter();

  const [value, setValue] = useState<StudentType | null>(initialStudentType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!value) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ student_type: value })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      void fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'verification.status.selected',
          metadata: { student_type: value },
        }),
      }).catch(() => undefined);

      router.refresh();
      router.push('/verify/email');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your status. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}

      <StatusSelector value={value} onSelect={setValue} disabled={saving} />

      <Button
        type="button"
        size="lg"
        fullWidth
        disabled={!value}
        loading={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save and continue'}
        {!saving ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
      </Button>
    </div>
  );
}
