import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Resends the email confirmation link to the user.
 */
export async function POST(request: Request) {
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

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://campus-awaz.vercel.app'}/api/auth/callback`,
      },
    });

    if (error) {
      console.error('[auth/resend] failed:', error.message);
      return NextResponse.json(
        { error: 'Could not resend confirmation email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auth/resend] exception:', err);
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }
}
