import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { validateOtp } from '@/lib/validators';
import { OTP_MAX_ATTEMPTS } from '@/lib/constants';
import { statusAfterEmailConfirmed } from '@/lib/verification';

export async function POST(request: Request) {
  // --- Auth ----------------------------------------------------------------
  let user: { id: string; email?: string | undefined } | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser ?? null;
  } catch (err) {
    console.error(
      '[verify/email/confirm] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  // --- Input ---------------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email: rawEmail, otp: rawOtp } = (body ?? {}) as {
    email?: unknown;
    otp?: unknown;
  };

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const otp = typeof rawOtp === 'string' ? rawOtp.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const otpCheck = validateOtp(otp);
  if (!otpCheck.valid) {
    return NextResponse.json({ error: otpCheck.error }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Find the newest pending code for this user + email ------------------
  const { data: record, error: lookupError } = await admin
    .from('user_verification')
    .select('id, otp_hash, otp_expires_at, otp_attempts, status')
    .eq('user_id', user.id)
    .eq('method', 'email_otp')
    .eq('email_used', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('[verify/email/confirm] lookup failed:', lookupError.message);
    return NextResponse.json(
      { error: 'Could not verify the code. Please try again.' },
      { status: 500 }
    );
  }

  if (!record) {
    return NextResponse.json(
      { error: 'No active code for this email. Request a new one.' },
      { status: 400 }
    );
  }

  // --- Expiry --------------------------------------------------------------
  const expiresAt = record.otp_expires_at ? new Date(record.otp_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    await admin
      .from('user_verification')
      .update({ status: 'expired' })
      .eq('id', record.id);

    await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_FAILED, {
      userId: user.id,
      actor: 'user',
      metadata: { reason: 'expired', email },
      request,
    });

    return NextResponse.json(
      { error: 'This code has expired. Please request a new one.', code: 'expired' },
      { status: 400 }
    );
  }

  // --- Attempt ceiling -----------------------------------------------------
  if (record.otp_attempts >= OTP_MAX_ATTEMPTS) {
    await admin
      .from('user_verification')
      .update({ status: 'expired' })
      .eq('id', record.id);

    await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_FAILED, {
      userId: user.id,
      actor: 'user',
      metadata: { reason: 'too_many_attempts', email },
      request,
    });

    return NextResponse.json(
      {
        error: 'Too many incorrect attempts. Please request a new code.',
        code: 'too_many_attempts',
      },
      { status: 429 }
    );
  }

  // --- Compare -------------------------------------------------------------
  const matches = record.otp_hash
    ? await bcrypt.compare(otp, record.otp_hash)
    : false;

  if (!matches) {
    const attempts = record.otp_attempts + 1;
    const exhausted = attempts >= OTP_MAX_ATTEMPTS;

    await admin
      .from('user_verification')
      .update({
        otp_attempts: attempts,
        ...(exhausted ? { status: 'expired' as const } : {}),
      })
      .eq('id', record.id);

    await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_FAILED, {
      userId: user.id,
      actor: 'user',
      metadata: { reason: 'invalid_code', email, attempts },
      request,
    });

    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
    return NextResponse.json(
      {
        error: exhausted
          ? 'Incorrect code. You have run out of attempts — request a new code.'
          : `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        attempts_remaining: remaining,
      },
      { status: 400 }
    );
  }

  // --- Success -------------------------------------------------------------
  const verifiedAt = new Date().toISOString();

  await admin
    .from('user_verification')
    .update({
      status: 'verified',
      verified_at: verifiedAt,
      otp_hash: null, // never retain the hash after use
    })
    .eq('id', record.id);

  const { error: profileUpdateError } = await admin
    .from('profiles')
    .update({ affiliation_status: statusAfterEmailConfirmed() })
    .eq('id', user.id);

  if (profileUpdateError) {
    console.error(
      '[verify/email/confirm] profile update failed:',
      profileUpdateError.message
    );
    return NextResponse.json(
      { error: 'Verification succeeded but could not update your profile. Please contact support.' },
      { status: 500 }
    );
  }

  await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_CONFIRMED, {
    userId: user.id,
    actor: 'user',
    metadata: { email },
    request,
  });

  await audit(AUDIT_EVENTS.VERIFICATION_APPROVED, {
    userId: user.id,
    actor: 'system',
    metadata: { method: 'email_otp', email },
    request,
  });

  return NextResponse.json({ success: true, affiliation_status: 'verified' });
}
