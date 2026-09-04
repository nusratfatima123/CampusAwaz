import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canUseIntake, getIntakeQueue } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * GET /api/admin/intake
 *
 * The staff review queue: complaints in `submitted` or `assigned` that still
 * need a routing decision, together with the AI recommendation and the
 * departments/staff available for assignment.
 *
 * `lib/routing` uses the service-role client, so the role check below is the
 * authoritative guard (it mirrors the `is_staff()` RLS predicate) and the queue
 * builder filters sensitive cases by explicit `sensitive_case_access`.
 */
export async function GET() {
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

    const roles = ((roleRows ?? []) as unknown as {
      roles: { name: RoleName } | null;
    }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!canUseIntake(roles)) {
      return NextResponse.json(
        { error: 'You do not have access to the intake queue.' },
        { status: 403 }
      );
    }

    if (!profile?.university_id) {
      return NextResponse.json(
        { error: 'Your staff account is not linked to a university.' },
        { status: 400 }
      );
    }

    const queue = await getIntakeQueue(user.id, profile.university_id);

    return NextResponse.json({
      success: true,
      items: queue.items,
      departments: queue.departments.map((department) => ({
        id: department.id,
        key: department.key,
        name: department.name,
      })),
      staff: queue.staff,
      categories: queue.categories.map((category) => ({
        id: category.id,
        key: category.key,
        label: category.label,
        is_sensitive: category.is_sensitive,
      })),
    });
  } catch (err) {
    console.error(
      '[admin/intake] failed to load queue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }
}
