import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserNotifications } from '@/lib/notifications';

/**
 * GET /api/notifications
 *
 * Returns notifications for the authenticated user, newest first.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const notifications = await getUserNotifications(user.id, 50);

    return NextResponse.json({ success: true, notifications });
  } catch (err) {
    console.error(
      '[notifications] GET failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not load notifications.' },
      { status: 500 },
    );
  }
}
