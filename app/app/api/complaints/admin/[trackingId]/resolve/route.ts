import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createProofOfAction } from '@/lib/resolution';
import { canUseIntake } from '@/lib/routing';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/admin/[trackingId]/resolve
 *
 * Resolves a complaint with proof of action and optional resolution explanation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  try {
    const { trackingId } = await params;
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

    const { data: complaint } = await admin
      .from('complaints')
      .select('assigned_to')
      .eq('tracking_id', trackingId)
      .eq('university_id', profile.university_id)
      .maybeSingle();

    if (!complaint) {
      return NextResponse.json(
        { error: 'Complaint not found.' },
        { status: 404 },
      );
    }

    if (complaint.assigned_to && complaint.assigned_to !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned authority can resolve this complaint.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { actionTaken, resolutionExplanation } = body;

    if (!actionTaken || typeof actionTaken !== 'string' || actionTaken.trim().length < 10) {
      return NextResponse.json(
        { error: 'Action taken must be at least 10 characters.' },
        { status: 400 },
      );
    }

    const result = await createProofOfAction(
      {
        trackingId,
        actionTaken: actionTaken.trim(),
        resolutionExplanation: resolutionExplanation?.trim() || undefined,
        actor: { userId: user.id, roles, universityId: profile.university_id },
      },
      request,
    );

    return NextResponse.json({
      success: true,
      proofOfAction: result.proofOfAction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not resolve complaint.';
    console.error('[complaints/admin/resolve] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
