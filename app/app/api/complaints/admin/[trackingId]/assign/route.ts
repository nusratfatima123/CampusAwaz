import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assignComplaint } from '@/lib/complaint-management';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/admin/[trackingId]/assign
 *
 * Assigns a complaint to a staff member.
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
    const { assigneeId, departmentId, notes } = body;

    if (!assigneeId) {
      return NextResponse.json(
        { error: 'assigneeId is required.' },
        { status: 400 },
      );
    }

    await assignComplaint(
      {
        trackingId,
        assigneeId,
        departmentId,
        notes,
        actor: { userId: user.id, roles, universityId: profile.university_id },
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not assign complaint.';
    console.error('[complaints/admin/assign] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
