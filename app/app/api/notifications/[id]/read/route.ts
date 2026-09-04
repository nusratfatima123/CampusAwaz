import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markNotificationRead } from '@/lib/notifications';
import { audit, AUDIT_EVENTS } from '@/lib/audit';

/**
 * POST /api/notifications/[id]/read
 *
 * Marks a single notification as read.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    await markNotificationRead(id, user.id);

    await audit(AUDIT_EVENTS.NOTIFICATION_READ, {
      userId: user.id,
      actor: 'user',
      metadata: { notification_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      '[notifications/read] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not mark notification as read.' },
      { status: 500 },
    );
  }
}
