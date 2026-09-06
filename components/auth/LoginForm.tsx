'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/validators';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  // Surface messages passed through the query string by the middleware / register.
  useEffect(() => {
    const error = searchParams.get('error');
    const registered = searchParams.get('registered');

    if (error === 'not_configured') {
      setFormError(
        'Supabase is not configured yet. Add your keys to .env.local and restart the dev server.'
      );
    }
    if (registered === '1') {
      setNotice('Account created. Sign in to continue your verification.');
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const emailCheck = validateEmail(email);
    const nextErrors: typeof fieldErrors = {};
    if (!emailCheck.valid) nextErrors.email = emailCheck.error;
    if (!password) nextErrors.password = 'Password is required.';

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('invalid login')) {
          setFormError('Incorrect email or password. Please try again.');
          setNeedsConfirmation(false);
        } else if (message.includes('email not confirmed')) {
          setFormError(
            'Please check your email and click the confirmation link before signing in. Check your spam folder if you don\'t see it.'
          );
          setNeedsConfirmation(true);
        } else {
          setFormError(error.message);
          setNeedsConfirmation(false);
        }
        return;
      }

      if (!data.user) {
        setFormError('Sign in failed. Please try again.');
        return;
      }

      // Route based on verification state and role.
      const { data: profile } = await supabase
        .from('profiles')
        .select('affiliation_status')
        .eq('id', data.user.id)
        .maybeSingle();

      const nextParam = searchParams.get('next');
      const verified = profile?.affiliation_status === 'verified';

      // Staff users go to admin dashboard; students go to regular dashboard.
      const STAFF_ROLES = [
        'admin',
        'hod',
        'proctor',
        'female_focal_person',
        'hostel_warden',
        'counselor',
      ];
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('roles ( name )')
        .eq('user_id', data.user.id);
      const userRoles = ((roleRows ?? []) as unknown as { roles: { name: string } | null }[])
        .map((row) => row.roles?.name)
        .filter((n): n is string => Boolean(n));
      const isStaffUser = userRoles.some((role) => STAFF_ROLES.includes(role));

      if (!verified && !isStaffUser) {
        router.replace('/verify');
        router.refresh();
        return;
      }

      const destination = nextParam || (isStaffUser ? '/admin/dashboard' : '/dashboard');
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      setFormError('Please enter your email address first.');
      return;
    }

    setResending(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error || 'Could not resend confirmation email.');
        return;
      }

      setNotice('Confirmation email sent! Check your inbox and spam folder.');
      setNeedsConfirmation(false);
    } catch (err) {
      setFormError('Could not resend confirmation email. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {formError ? (
        <Alert tone="error" title="Unable to sign in">
          <div className="space-y-2">
            <p>{formError}</p>
            {needsConfirmation && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        </Alert>
      ) : null}

      <Input
        label="University email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@university.edu.pk"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email ?? null}
        leadingIcon={<Mail className="h-4 w-4" />}
        required
      />

      <div>
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password ?? null}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((show) => !show)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-[2.65rem] rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
        {!submitting ? <LogIn className="h-4 w-4" aria-hidden="true" /> : null}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Forgot your password? Contact your university support desk.{' '}
        <Link href="/register" className="font-semibold text-blue-900 hover:underline">
          Register instead
        </Link>
      </p>
    </form>
  );
}
