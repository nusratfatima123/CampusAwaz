import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUnreadCount } from '@/lib/notifications';

/**
 * GET /api/notifications/unread-count
 *
 * Returns the count of unread notifications for the authenticated user.
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

    const count = await getUnreadCount(user.id);

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error(
      '[notifications/unread-count] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not get unread count.' },
      { status: 500 },
    );
  }
}
