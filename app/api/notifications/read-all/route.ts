import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markAllNotificationsRead } from '@/lib/notifications';
import { audit, AUDIT_EVENTS } from '@/lib/audit';

/**
 * POST /api/notifications/read-all
 *
 * Marks all notifications for the authenticated user as read.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    await markAllNotificationsRead(user.id);

    await audit(AUDIT_EVENTS.NOTIFICATION_READ_ALL, {
      userId: user.id,
      actor: 'user',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      '[notifications/read-all] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not mark all notifications as read.' },
      { status: 500 },
    );
  }
}
