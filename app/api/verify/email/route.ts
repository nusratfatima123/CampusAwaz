import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { validateEmailForUniversity } from '@/lib/validators';
import {
  getOtpTtlSeconds,
  OTP_LENGTH,
  OTP_MAX_SENDS_PER_HOUR,
} from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limit';
import { statusAfterOtpRequested } from '@/lib/verification';

/** Cryptographically strong N-digit numeric code. */
function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const value = (array[0] ?? 0) % max;
  return value.toString().padStart(OTP_LENGTH, '0');
}

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
      '[verify/email] Supabase is not configured:',
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

  const email =
    typeof (body as { email?: unknown })?.email === 'string'
      ? ((body as { email: string }).email ?? '').trim().toLowerCase()
      : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // --- Rate limit: max sends per hour, per user ----------------------------
  const limit = checkRateLimit(`otp:send:${user.id}`, OTP_MAX_SENDS_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many codes requested. Try again in ${Math.ceil(
          limit.retryAfterSeconds / 60
        )} minute(s).`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const admin = createAdminClient();

  // --- Validate the email against the user's university -------------------
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('affiliation_status, university_id, universities ( name, allowed_email_domains )')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Could not load your profile. Please try again.' },
      { status: 500 }
    );
  }

  if (!profile.university_id) {
    return NextResponse.json(
      { error: 'Select your university before verifying your email.' },
      { status: 400 }
    );
  }

  const university = profile.universities as unknown as {
    name: string;
    allowed_email_domains: string[];
  } | null;

  const domainCheck = validateEmailForUniversity(
    email,
    university?.allowed_email_domains ?? []
  );

  if (!domainCheck.valid) {
    await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_FAILED, {
      userId: user.id,
      actor: 'user',
      metadata: { reason: 'domain_mismatch', email },
      request,
    });
    return NextResponse.json({ error: domainCheck.error }, { status: 400 });
  }

  // --- Issue the OTP -------------------------------------------------------
  const ttlSeconds = getOtpTtlSeconds();
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // Supersede any earlier pending codes for this user so only the newest works.
  await admin
    .from('user_verification')
    .update({ status: 'expired' })
    .eq('user_id', user.id)
    .eq('method', 'email_otp')
    .eq('status', 'pending');

  const { error: insertError } = await admin.from('user_verification').insert({
    user_id: user.id,
    method: 'email_otp',
    status: 'pending',
    email_used: email,
    otp_hash: otpHash,
    otp_expires_at: expiresAt,
    otp_attempts: 0,
  });

  if (insertError) {
    console.error('[verify/email] insert failed:', insertError.message);
    return NextResponse.json(
      { error: 'Could not create a verification code. Please try again.' },
      { status: 500 }
    );
  }

  // Advance the state machine (never demote an already-verified user).
  const nextStatus = statusAfterOtpRequested(profile.affiliation_status);
  if (nextStatus !== profile.affiliation_status) {
    await admin
      .from('profiles')
      .update({ affiliation_status: nextStatus })
      .eq('id', user.id);
  }

  await audit(AUDIT_EVENTS.VERIFICATION_EMAIL_SENT, {
    userId: user.id,
    actor: 'system',
    metadata: { email, ttl_seconds: ttlSeconds },
    request,
  });

  /*
   * SRS §4.2 places email/SMS delivery out of MVP scope, so the code is logged
   * to the server console for the prototype. Wire a mail provider here to ship
   * real messages.
   */
  console.info(
    `\n[CampusAwaz] Verification code for ${email}: ${otp}  (expires in ${ttlSeconds}s)\n`
  );

  return NextResponse.json({ success: true, expires_in: ttlSeconds });
}
