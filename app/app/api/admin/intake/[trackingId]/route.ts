import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRoutingDecision, canUseIntake } from '@/lib/routing';
import { isTrackingIdShape, isUuid, validatePriority } from '@/lib/validators';
import type { ComplaintPriority, RoleName } from '@/types/database';

/**
 * POST /api/admin/intake/[trackingId]
 *
 * The human-review gate. An authorized staff member confirms or overrides the AI
 * recommendation (category / priority / department) and assigns an owner.
 *
 * All of the enforcement lives in `applyRoutingDecision`, which additionally
 * grants `sensitive_case_access` before the assignment lands and writes the
 * `ai.recommendation.overridden` / `complaint.assigned` audit entries.
 */
export async function POST(
  request: Request,
  { params }: { params: { trackingId: string } }
) {
  let userId: string;
  let roles: RoleName[];
  let universityId: string | null;

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
        .select('id, university_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    roles = ((roleRows ?? []) as unknown as {
      roles: { name: RoleName } | null;
    }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    userId = user.id;
    universityId = profile?.university_id ?? null;
  } catch (err) {
    console.error(
      '[admin/intake] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }

  if (!canUseIntake(roles)) {
    return NextResponse.json(
      { error: 'You do not have access to the intake queue.' },
      { status: 403 }
    );
  }

  const trackingId = String(params.trackingId ?? '').trim().toUpperCase();
  if (!isTrackingIdShape(trackingId)) {
    return NextResponse.json({ error: 'Invalid tracking ID.' }, { status: 400 });
  }

  // --- Body ----------------------------------------------------------------
  let body: {
    categoryId?: unknown;
    priority?: unknown;
    departmentId?: unknown;
    assigneeId?: unknown;
    reason?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const readId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const categoryId = readId(body.categoryId);
  const departmentId = readId(body.departmentId);
  const assigneeId = readId(body.assigneeId);
  const priority = readId(body.priority);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

  for (const [label, value] of [
    ['category', categoryId],
    ['department', departmentId],
    ['staff member', assigneeId],
  ] as const) {
    if (value && !isUuid(value)) {
      return NextResponse.json(
        { error: `Invalid ${label} selection.` },
        { status: 400 }
      );
    }
  }

  if (priority) {
    const priorityCheck = validatePriority(priority);
    if (!priorityCheck.valid) {
      return NextResponse.json({ error: priorityCheck.error }, { status: 400 });
    }
  }

  if (reason && reason.length > 1000) {
    return NextResponse.json(
      { error: 'Keep the override reason under 1000 characters.' },
      { status: 400 }
    );
  }

  // --- Apply ---------------------------------------------------------------
  try {
    const result = await applyRoutingDecision(
      {
        trackingId,
        categoryId,
        priority: (priority as ComplaintPriority | null) ?? null,
        departmentId,
        assigneeId,
        reason,
      },
      { userId, roles, universityId },
      request
    );

    return NextResponse.json({
      success: true,
      tracking_id: result.trackingId,
      status: result.status,
      category_id: result.categoryId,
      priority: result.priority,
      department_id: result.departmentId,
      assigned_to: result.assignedTo,
      overrode_recommendation: result.overrodeRecommendation,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not apply the routing decision.';
    console.error('[admin/intake] routing failed:', message);

    const status = /not authorized|restricted/i.test(message)
      ? 403
      : /not found/i.test(message)
        ? 404
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
