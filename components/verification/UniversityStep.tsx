'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { UniversityPicker, type UniversityOption } from './UniversityPicker';
import { createClient } from '@/lib/supabase/client';

/**
 * Client wrapper for the standalone /verify/university screen.
 *
 * Persists `profiles.university_id` (RLS restricts the update to the caller's
 * own row) and records the `verification.university.selected` audit event via
 * the server-side /api/audit route, which derives the actor from the session.
 */
export function UniversityStep({
  universities,
  initialUniversityId,
}: {
  universities: UniversityOption[];
  initialUniversityId: string | null;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<UniversityOption | null>(
    universities.find((u) => u.id === initialUniversityId) ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!selected) return;

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
        .update({ university_id: selected.id })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Audit is best-effort — never block the user on a logging failure.
      void fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'verification.university.selected',
          metadata: { university_id: selected.id, university_code: selected.code },
        }),
      }).catch(() => undefined);

      router.refresh();
      router.push('/verify/status');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your university. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (universities.length === 0) {
    return (
      <Alert tone="warning" title="No universities available">
        The university list could not be loaded. Confirm your Supabase keys in
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">.env.local</code>
        and that the seed migration has been applied.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="error" title="Could not save">
          {error}
        </Alert>
      ) : null}

      <UniversityPicker
        universities={universities}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        disabled={saving}
      />

      <Button
        type="button"
        size="lg"
        fullWidth
        disabled={!selected}
        loading={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save and continue'}
        {!saving ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
      </Button>
    </div>
  );
}
