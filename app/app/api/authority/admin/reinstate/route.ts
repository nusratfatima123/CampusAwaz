import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reinstateAuthority, getAuthorityRequest } from '@/lib/authority';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * POST /api/authority/admin/reinstate
 * Admin: reinstate a suspended authority (re-inserts user_roles row).
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required.' },
        { status: 400 },
      );
    }

    const existing = await getAuthorityRequest(requestId);
    if (!existing) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (existing.university_id !== profile.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const result = await reinstateAuthority(requestId, user.id, request);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reinstate authority.';
    console.error('[authority/admin/reinstate] POST failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
