import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestIdentityAccess } from '@/lib/identity-access';
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

    const body = await request.json();
    const { complaintId } = body;

    if (!complaintId) {
      return NextResponse.json({ error: 'complaintId is required.' }, { status: 400 });
    }

    const result = await requestIdentityAccess(complaintId, user.id, roles, request);
    return NextResponse.json({ success: true, request: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not submit identity request.';
    console.error('[identity-access/request] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
