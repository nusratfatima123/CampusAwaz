import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthorityRequests } from '@/lib/authority';
import { canUseIntake } from '@/lib/routing';
import type { RoleName, AuthorityRequestStatus } from '@/types/database';

/**
 * GET /api/authority/admin/requests
 * Admin: list authority requests with optional filters.
 */
export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as AuthorityRequestStatus | null;
    const roleId = url.searchParams.get('roleId');

    const requests = await getAuthorityRequests({
      universityId: profile.university_id,
      status: status ?? undefined,
      roleId: roleId ?? undefined,
    });

    const { data: roleLookup } = await admin.from('roles').select('id, name');
    const roleMap = new Map((roleLookup ?? []).map((r) => [r.id, r.name]));

    const { data: profileLookup } = await admin
      .from('profiles')
      .select('id, full_name, phone');
    const profileMap = new Map((profileLookup ?? []).map((p) => [p.id, p]));

    const enriched = requests.map((r) => ({
      ...r,
      role_name: roleMap.get(r.role_id) ?? null,
      user_name: profileMap.get(r.user_id)?.full_name ?? null,
      user_phone: profileMap.get(r.user_id)?.phone ?? null,
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch requests.';
    console.error('[authority/admin/requests] GET failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
