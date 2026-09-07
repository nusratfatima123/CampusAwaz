import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAssignableStaff, canUseIntake, getDepartments } from '@/lib/routing';
import type { RoleName } from '@/types/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

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

    if (!canUseIntake(roles) || !profile?.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    let staff = await getAssignableStaff(profile.university_id);

    if (departmentId) {
      const departments = await getDepartments(profile.university_id);
      const dept = departments.find((d) => d.id === departmentId);
      if (dept) {
        staff = [...staff].sort((a, b) => {
          const aMatch = a.departmentKeys.includes(dept.key) ? 0 : 1;
          const bMatch = b.departmentKeys.includes(dept.key) ? 0 : 1;
          return aMatch - bMatch;
        });
      }
    }

    return NextResponse.json({ success: true, staff });
  } catch (err) {
    console.error(
      '[complaints/admin/staff] failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: 'Could not load staff list.' },
      { status: 500 },
    );
  }
}
