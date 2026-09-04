import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { createClient } from '@/lib/supabase/server';
import { Alert } from '@/components/ui/Alert';
import type { UniversityOption } from '@/components/verification/UniversityPicker';

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Register with your university to report issues and track real action on CampusAwaz.',
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

export default async function RegisterPage() {
  const { universities, error } = await loadUniversities();

  return (
    <div className="bg-gray-50 py-16 md:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Create your account
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Four short steps. Your details stay private and are only used to confirm
              your university affiliation.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            {error ? (
              <Alert tone="warning" title="Universities could not be loaded">
                {error} You can still fill in your details, but university selection
                needs a working Supabase connection.
              </Alert>
            ) : null}

            <RegisterForm universities={universities} />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="rounded font-semibold text-blue-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
