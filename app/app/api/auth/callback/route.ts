import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { audit, AUDIT_EVENTS } from '@/lib/audit';

/**
 * Supabase auth code-exchange handler.
 * Used for email confirmation links and any OAuth callbacks.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/verify';
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    if (data.user) {
      await audit(AUDIT_EVENTS.USER_LOGIN, {
        userId: data.user.id,
        actor: 'user',
        metadata: { method: 'auth_callback' },
        request,
      });
    }

    // Send verified users straight to the dashboard.
    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliation_status')
      .eq('id', data.user?.id ?? '')
      .maybeSingle();

    const destination =
      profile?.affiliation_status === 'verified' ? '/dashboard' : next;

    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    console.error('[auth/callback] exchange failed:', err);
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}
