import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server is not configured.' },
      { status: 503 }
    );
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('[auth/confirm-email] listUsers failed:', listError.message);
      return NextResponse.json(
        { error: 'Could not confirm email. Please try again.' },
        { status: 500 }
      );
    }

    const user = users.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with that email.' },
        { status: 404 }
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

    if (updateError) {
      console.error('[auth/confirm-email] update failed:', updateError.message);
      return NextResponse.json(
        { error: 'Could not confirm email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auth/confirm-email] exception:', err);
    return NextResponse.json(
      { error: 'Could not confirm email. Please try again.' },
      { status: 500 }
    );
  }
}
