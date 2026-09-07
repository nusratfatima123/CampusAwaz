import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveIdentityRequest, denyIdentityRequest } from '@/lib/identity-access';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/identity-access/[requestId]/admin-decision
 *
 * Admin approves or denies an identity access request.
 * Body: { action: 'approve' | 'deny', notes?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: roleRows } = await admin
      .from('user_roles')
      .select('roles ( name )')
      .eq('user_id', user.id);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, notes } = body;

    if (action !== 'approve' && action !== 'deny') {
      return NextResponse.json(
        { error: 'action must be "approve" or "deny".' },
        { status: 400 },
      );
    }

    if (action === 'approve') {
      const result = await approveIdentityRequest(requestId, user.id, notes, request);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else {
      const result = await denyIdentityRequest(requestId, user.id, notes, request);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not process decision.';
    console.error('[identity-access/admin-decision] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
