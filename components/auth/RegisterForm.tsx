'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  Mail,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Stepper } from '@/components/ui/Stepper';
import {
  UniversityPicker,
  type UniversityOption,
} from '@/components/verification/UniversityPicker';
import { StatusSelector } from '@/components/verification/StatusSelector';
import { createClient } from '@/lib/supabase/client';
import {
  validateEmail,
  validateEmailForUniversity,
  validateFullName,
  validatePassword,
} from '@/lib/validators';
import type { StudentType } from '@/types/database';

const STEPS = [
  { label: 'Your details' },
  { label: 'University' },
  { label: 'Status' },
  { label: 'Confirm' },
];

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm({
  universities,
}: {
  universities: UniversityOption[];
}) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1 — details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Step 2 — university
  const [university, setUniversity] = useState<UniversityOption | null>(null);
  const [universityError, setUniversityError] = useState<string | null>(null);

  // Step 3 — status
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  /**
   * Once a university is chosen we can check the email domain. This is a
   * *warning* only — students may register with a personal address and verify
   * a university email later in the /verify flow.
   */
  const domainWarning = useMemo(() => {
    if (!university || !email.trim()) return null;
    const result = validateEmailForUniversity(email, university.allowed_email_domains);
    return result.valid ? null : result.error ?? null;
  }, [university, email]);

  function validateDetails(): boolean {
    const next: FieldErrors = {};

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) next.fullName = nameCheck.error;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) next.email = emailCheck.error;

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) next.password = pwCheck.error;

    if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    setFormError(null);

    if (step === 0) {
      if (!validateDetails()) return;
    }
    if (step === 1) {
      if (!university) {
        setUniversityError('Select your university to continue.');
        return;
      }
      setUniversityError(null);
    }
    if (step === 2) {
      if (!studentType) {
        setStatusError('Choose whether you are a current student or a graduate.');
        return;
      }
      setStatusError(null);
    }

    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setFormError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Guard: never submit from an earlier step.
    if (step !== STEPS.length - 1) {
      goNext();
      return;
    }

    if (!validateDetails() || !university || !studentType) {
      setFormError('Some details are missing. Please review the earlier steps.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setDuplicate(false);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            university_id: university.id,
            student_type: studentType,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('already registered') ||
          message.includes('already exists') ||
          message.includes('user already')
        ) {
          setDuplicate(true);
          return;
        }
        setFormError(error.message);
        return;
      }

      // Supabase returns an obfuscated user with no identities when the email
      // is already taken and confirmations are enabled.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setDuplicate(true);
        return;
      }

      // Record the registration audit event (best-effort, server-side).
      // The API route resolves the user from the session; it never trusts a
      // client-supplied id.
      if (data.user) {
        void fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'user.registered',
            metadata: {
              university_code: university.code,
              student_type: studentType,
            },
          }),
        }).catch(() => undefined);
      }

      // A session exists when email confirmation is disabled → go straight in.
      if (data.session) {
        router.replace('/verify');
        router.refresh();
        return;
      }

      // Email confirmation is required → auto-confirm and sign-in
      if (data.user) {
        try {
          const confirmRes = await fetch('/api/auth/confirm-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
          });

          if (confirmRes.ok) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

            if (!signInError) {
              router.replace('/verify');
              router.refresh();
              return;
            }
          }
        } catch {
          // Fall through to fallback message
        }
      }

      // Fallback: show success message if auto-confirm fails
      setFormError(null);
      setNotice('Check your email to confirm your account before signing in.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setUniversity(null);
      setStudentType(null);
      setStep(0);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stepper items={STEPS} currentIndex={step} className="mb-8" />

      {duplicate ? (
        <Alert tone="warning" title="This email already has an account" className="mb-6">
          It looks like you have registered before.{' '}
          <Link href="/login" className="font-semibold underline">
            Sign in instead
          </Link>{' '}
          to continue where you left off.
        </Alert>
      ) : null}

      {notice ? (
        <Alert tone="success" className="mb-6">
          {notice}
        </Alert>
      ) : null}

      {formError ? (
        <Alert tone="error" title="Registration failed" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {step === 0 ? (
        <div className="space-y-5">
          <Input
            label="Full name"
            name="fullName"
            autoComplete="name"
            placeholder="Ayesha Khan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName ?? null}
            required
          />

          <Input
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@university.edu.pk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email ?? null}
            leadingIcon={<Mail className="h-4 w-4" />}
            hint="Use your university email if you have one — it speeds up verification."
            required
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password ?? null}
              hint="Minimum 8 characters, including a letter and a number."
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

          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword ?? null}
            required
          />
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {step === 1 ? (
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Which university are you affiliated with?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose your institution so we can route your complaints to the right
            office.
          </p>

          <div className="mt-6">
            <UniversityPicker
              universities={universities}
              selectedId={university?.id ?? null}
              onSelect={(next) => {
                setUniversity(next);
                setUniversityError(null);
              }}
            />
          </div>

          {universityError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-red-600">
              {universityError}
            </p>
          ) : null}

          {domainWarning ? (
            <Alert tone="warning" title="Email domain notice" className="mt-6">
              {domainWarning} You can still register now and verify an official
              university email in the next step.
            </Alert>
          ) : null}
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {step === 2 ? (
        <div>
          <h2 className="text-lg font-bold text-slate-900">What is your status?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Both current students and graduates can use CampusAwaz.
          </p>

          <div className="mt-6">
            <StatusSelector
              value={studentType}
              onSelect={(next) => {
                setStudentType(next);
                setStatusError(null);
              }}
            />
          </div>

          {statusError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-red-600">
              {statusError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {step === 3 ? (
        <div>
          <h2 className="text-lg font-bold text-slate-900">Review and confirm</h2>
          <p className="mt-2 text-sm text-slate-600">
            Check your details. You will verify your university email next.
          </p>

          <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-gray-50">
            <SummaryRow
              icon={<UserPlus className="h-4 w-4 text-slate-400" />}
              label="Full name"
              value={fullName.trim()}
            />
            <SummaryRow
              icon={<Mail className="h-4 w-4 text-slate-400" />}
              label="Email"
              value={email.trim()}
            />
            <SummaryRow
              icon={<Building2 className="h-4 w-4 text-slate-400" />}
              label="University"
              value={university ? `${university.name} (${university.code})` : '—'}
            />
            <SummaryRow
              icon={<GraduationCap className="h-4 w-4 text-slate-400" />}
              label="Status"
              value={
                studentType === 'graduate'
                  ? 'Graduate / Alumni'
                  : studentType === 'current_student'
                    ? 'Current Student'
                    : '—'
              }
            />
          </dl>

          {domainWarning ? (
            <Alert tone="warning" title="Email domain notice" className="mt-6">
              {domainWarning}
            </Alert>
          ) : null}

          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            By creating an account you agree to use CampusAwaz responsibly. Your
            personal details are never shown to other students, and privacy settings
            are applied to every complaint you file.
          </p>
        </div>
      ) : null}

      {/* Navigation ------------------------------------------------------ */}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={goBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}

        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" loading={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
            {!submitting ? <UserPlus className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>
        )}
      </div>
    </form>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <dt className="flex items-center gap-2 text-sm text-slate-600">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right text-sm font-semibold text-slate-900">
        {value || '—'}
      </dd>
    </div>
  );
}
