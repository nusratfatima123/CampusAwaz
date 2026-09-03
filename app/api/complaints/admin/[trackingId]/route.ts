import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getComplaintDetail } from '@/lib/complaint-management';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * GET /api/complaints/admin/[trackingId]
 *
 * Returns full complaint detail for admin view with privacy-aware identity.
 */
export async function GET(
  _request: Request,
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

    if (!canUseIntake(roles)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const detail = await getComplaintDetail(trackingId, user.id, roles);
    if (!detail) {
      return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...detail });
  } catch (err) {
    console.error(
      '[complaints/admin/detail] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: 'Could not load complaint.' }, { status: 500 });
  }
}
