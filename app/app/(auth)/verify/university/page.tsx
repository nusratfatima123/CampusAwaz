import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifyStepShell } from '@/components/verification/VerifyStepShell';
import { UniversityStep } from '@/components/verification/UniversityStep';
import type { UniversityOption } from '@/components/verification/UniversityPicker';
import { Alert } from '@/components/ui/Alert';
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Select your university',
  description: 'Choose the Pakistani university you are affiliated with.',
};

async function loadUniversities(): Promise<{
  universities: UniversityOption[];
  error: string | null;
}> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, code, allowed_email_domains')
      .eq('is_active', true)
      .order('name');

    if (error) return { universities: [], error: error.message };
    return { universities: (data ?? []) as UniversityOption[], error: null };
  } catch (err) {
    return {
      universities: [],
      error:
        err instanceof Error
          ? err.message
          : 'Supabase is not configured. Add your keys to .env.local.',
    };
  }
}

export default async function VerifyUniversityPage() {
  const { user, profile } = await getAuthContext();
  if (!user) redirect('/login');

  const { universities, error } = await loadUniversities();

  return (
    <VerifyStepShell
      title="Select your university"
      description="Pick the institution you are affiliated with. This determines which email domains we accept when verifying you."
    >
      {error ? (
        <div className="mb-6">
          <Alert tone="warning" title="Universities could not be loaded">
            {error}
          </Alert>
        </div>
      ) : null}

      <UniversityStep
        universities={universities}
        initialUniversityId={profile?.university_id ?? null}
      />
    </VerifyStepShell>
  );
}
