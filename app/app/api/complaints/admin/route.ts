import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getComplaintList, getDashboardSummary } from '@/lib/complaint-management';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * GET /api/complaints/admin
 *
 * Returns the admin complaint list with filters and dashboard summary counts.
 * Role-filtered: each admin sees only permitted complaints.
 */
export async function GET(request: Request) {
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
      admin
        .from('profiles')
        .select('id, university_id, affiliation_status')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!canUseIntake(roles)) {
      return NextResponse.json(
        { error: 'You do not have access to the admin complaint list.' },
        { status: 403 },
      );
    }

    if (!profile?.university_id) {
      return NextResponse.json(
        { error: 'Your staff account is not linked to a university.' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryKey = searchParams.get('category') ?? undefined;
    const departmentKey = searchParams.get('department') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const priority = searchParams.get('priority') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = Number(searchParams.get('limit') ?? '50');
    const offset = Number(searchParams.get('offset') ?? '0');

    const [listResult, summary] = await Promise.all([
      getComplaintList({
        universityId: profile.university_id,
        userId: user.id,
        roles,
        categoryKey,
        departmentKey,
        status,
        priority,
        search,
        limit,
        offset,
      }),
      getDashboardSummary(profile.university_id, user.id, roles),
    ]);

    return NextResponse.json({
      success: true,
      items: listResult.items,
      total: listResult.total,
      summary,
    });
  } catch (err) {
    console.error(
      '[complaints/admin] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not load complaints.' },
      { status: 500 },
    );
  }
}
