import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminDecideIdentityRequest } from '@/lib/identity-access';
import type { RoleName } from '@/types/database';

export async function POST(request: Request) {
  try {
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
    const { requestId, approve, notes } = body;

    if (!requestId || typeof approve !== 'boolean') {
      return NextResponse.json(
        { error: 'requestId and approve (boolean) are required.' },
        { status: 400 },
      );
    }

    const result = await adminDecideIdentityRequest(requestId, user.id, approve, notes, request);
    return NextResponse.json({ success: true, request: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not process identity request.';
    console.error('[identity-access/admin-decide] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
