import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSlaEscalationScan } from '@/lib/escalation';
import type { RoleName } from '@/types/database';

/**
 * POST /api/admin/escalation-check
 *
 * Triggers the SLA escalation scan for the caller's university.
 * Restricted to admin roles.
 */
export async function POST() {
  try {
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

    const isAdmin = roles.includes('admin');
    if (!isAdmin || !(profile as { university_id: string } | null)?.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const result = await runSlaEscalationScan(
      (profile as { university_id: string }).university_id,
      user.id,
    );

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      escalated: result.escalated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Escalation check failed.';
    console.error('[admin/escalation-check] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
