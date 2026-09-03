'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Mail, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { OTP_LENGTH } from '@/lib/constants';
import { validateEmailForUniversity } from '@/lib/validators';
import { cn } from '@/lib/cn';

type Phase = 'request' | 'confirm' | 'done';

export function OtpForm({
  allowedDomains,
  initialEmail,
}: {
  allowedDomains: string[];
  initialEmail?: string | null;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('request');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otp = useMemo(() => digits.join(''), [digits]);

  // Countdown for the current code's TTL.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Focus the first OTP box when entering the confirm phase.
  useEffect(() => {
    if (phase === 'confirm') inputRefs.current[0]?.focus();
  }, [phase]);

  async function sendOtp(isResend = false) {
    setFormError(null);
    setNotice(null);

    const check = validateEmailForUniversity(email, allowedDomains);
    if (!check.valid) {
      setEmailError(check.error ?? 'Enter a valid university email.');
      return;
    }
    setEmailError(null);
    setSending(true);

    try {
      const response = await fetch('/api/verify/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        expires_in?: number;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setFormError(payload.error ?? 'Could not send the code. Please try again.');
        return;
      }

      setPhase('confirm');
      setDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(payload.expires_in ?? 300);
      setNotice(
        isResend
          ? 'A new code has been sent. The previous code is no longer valid.'
          : 'Code sent. Check the server console — email delivery is out of scope for this release.'
      );
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function confirmOtp(code: string) {
    setFormError(null);
    setNotice(null);
    setConfirming(true);

    try {
      const response = await fetch('/api/verify/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload.success) {
        setFormError(payload.error ?? 'Verification failed.');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        if (payload.code === 'expired' || payload.code === 'too_many_attempts') {
          setSecondsLeft(0);
        }
        return;
      }

      setPhase('done');
      // Refresh so the layout/nav pick up the new verified state.
      router.refresh();
      setTimeout(() => router.push('/verify'), 1200);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  function handleDigitChange(index: number, rawValue: string) {
    const cleaned = rawValue.replace(/\D/g, '');

    // Paste of a full code.
    if (cleaned.length > 1) {
      const next = cleaned.slice(0, OTP_LENGTH).split('');
      const padded = Array.from(
        { length: OTP_LENGTH },
        (_, i) => next[i] ?? ''
      );
      setDigits(padded);
      const lastIndex = Math.min(next.length, OTP_LENGTH) - 1;
      inputRefs.current[lastIndex]?.focus();
      if (next.length >= OTP_LENGTH) void confirmOtp(padded.join(''));
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    // Auto-advance.
    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit once every box is filled.
    const joined = next.join('');
    if (joined.length === OTP_LENGTH && !joined.includes('')) {
      void confirmOtp(joined);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  // ---------------------------------------------------------------- done
  if (phase === 'done') {
    return (
      <Alert tone="success" title="Email verified">
        Your university email is confirmed. Redirecting to your verification
        summary…
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Allowed domains */}
      {allowedDomains.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Accepted email domains
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {allowedDomains.map((domain) => (
              <li
                key={domain}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
              >
                @{domain}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {formError ? (
        <Alert tone="error" title="Verification problem">
          {formError}
        </Alert>
      ) : null}

      {/* ------------------------------------------------------- request */}
      {phase === 'request' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp(false);
          }}
          noValidate
          className="space-y-5"
        >
          <Input
            label="University email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            placeholder="you@university.edu.pk"
            leadingIcon={<Mail className="h-4 w-4" />}
            autoComplete="email"
            required
          />
          <Button type="submit" size="lg" loading={sending} fullWidth>
            {sending ? 'Sending code…' : 'Send OTP'}
            {!sending ? <Send className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>
        </form>
      ) : null}

      {/* ------------------------------------------------------- confirm */}
      {phase === 'confirm' ? (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-slate-600">
              We sent a {OTP_LENGTH}-digit code to{' '}
              <span className="font-semibold text-slate-900">{email}</span>.
            </p>
            {secondsLeft > 0 ? (
              <p className="mt-1 text-sm text-slate-500">
                Expires in{' '}
                <span className="font-semibold tabular-nums text-slate-700">
                  {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-amber-700">
                This code has expired. Request a new one.
              </p>
            )}
          </div>

          <fieldset disabled={confirming}>
            <legend className="mb-3 block text-sm font-medium text-slate-800">
              Enter verification code
            </legend>
            <div className="flex gap-2 sm:gap-3">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                  className={cn(
                    'no-spinner h-14 w-full rounded-xl border border-slate-200 text-center text-xl font-bold text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50',
                    digit && 'border-blue-300 bg-blue-50/40'
                  )}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              loading={confirming}
              onClick={() => void confirmOtp(otp)}
              disabled={otp.length !== OTP_LENGTH}
            >
              {confirming ? 'Verifying…' : 'Verify'}
              {!confirming ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : null}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={sending}
              onClick={() => void sendOtp(true)}
            >
              {!sending ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : null}
              {sending ? 'Sending…' : 'Resend code'}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setPhase('request');
              setFormError(null);
              setNotice(null);
            }}
            className="rounded-lg text-sm font-medium text-slate-600 hover:text-blue-900 hover:underline"
          >
            Use a different email address
          </button>
        </div>
      ) : null}
    </div>
  );
}
