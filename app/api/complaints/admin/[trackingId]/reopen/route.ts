import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { changeComplaintStatus } from '@/lib/complaint-management';
import { canUseIntake } from '@/lib/routing';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/admin/[trackingId]/reopen
 *
 * Reopens a resolved complaint for further review.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  try {
    const { trackingId } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
      admin
        .from('profiles')
        .select('id, university_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!canUseIntake(roles) || !profile?.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'A reason of at least 10 characters is required to reopen.' },
        { status: 400 },
      );
    }

    await changeComplaintStatus(
      {
        trackingId,
        newStatus: 'reopened',
        notes: reason.trim(),
        actor: { userId: user.id, roles, universityId: profile.university_id },
      },
      request,
    );

    await audit(AUDIT_EVENTS.COMPLAINT_REOPENED, {
      userId: user.id,
      actor: 'admin',
      metadata: {
        tracking_id: trackingId,
        reason: reason.trim(),
      },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reopen complaint.';
    console.error('[complaints/admin/reopen] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
