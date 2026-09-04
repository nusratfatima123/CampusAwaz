import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateCounselingStatus } from '@/lib/support';
import type { CounselingStatus, RoleName } from '@/types/database';

/**
 * PATCH /api/support/counseling/[id]/status
 *
 * Updates the status of a counseling request.
 * Restricted to counselor role.
 */
export async function PATCH(
  request: Request,
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

    const admin = createAdminClient();

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
      admin.from('profiles').select('university_id').eq('id', user.id).maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    const isCounselor = roles.includes('counselor');
    const universityId = (profile as { university_id: string } | null)?.university_id;

    if (!isCounselor || !universityId) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    const validStatuses: CounselingStatus[] = ['pending', 'assigned', 'in_progress', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await updateCounselingStatus(
      id,
      status as CounselingStatus,
      { userId: user.id, roles, universityId },
      request,
    );

    return NextResponse.json({
      success: true,
      counselingRequest: result.counselingRequest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update status.';
    console.error('[support/counseling/status] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
