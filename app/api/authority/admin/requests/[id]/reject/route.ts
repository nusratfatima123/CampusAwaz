import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rejectAuthorityRequest, getAuthorityRequest } from '@/lib/authority';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * POST /api/authority/admin/requests/[id]/reject
 * Admin: reject an authority request.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
      admin.from('profiles').select('id, university_id').eq('id', user.id).maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!canUseIntake(roles) || !profile?.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Admin role required.' }, { status: 403 });
    }

    const existing = await getAuthorityRequest(id);
    if (!existing) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (existing.university_id !== profile.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'A rejection reason is required (min 5 characters).' },
        { status: 400 },
      );
    }

    const result = await rejectAuthorityRequest(id, user.id, reason, request);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject request.';
    console.error('[authority/admin/requests/[id]/reject] POST failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
