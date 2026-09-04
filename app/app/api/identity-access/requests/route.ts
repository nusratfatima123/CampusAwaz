import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getIdentityRequestsForComplaint } from '@/lib/identity-access';
import type { RoleName } from '@/types/database';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const complaintId = searchParams.get('complaintId');

    if (!complaintId) {
      return NextResponse.json({ error: 'complaintId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('roles ( name )')
      .eq('user_id', user.id);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    const isAdmin = roles.includes('admin');

    if (!isAdmin) {
      const { data: complaint } = await admin
        .from('complaints')
        .select('assigned_to')
        .eq('id', complaintId)
        .maybeSingle();

      if ((complaint as { assigned_to: string } | null)?.assigned_to !== user.id) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
    }

    const requests = await getIdentityRequestsForComplaint(complaintId);
    return NextResponse.json({ requests });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load identity requests.';
    console.error('[identity-access/requests] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
