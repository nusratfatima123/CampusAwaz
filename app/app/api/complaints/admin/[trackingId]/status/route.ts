import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { changeComplaintStatus, isValidStatusTransition } from '@/lib/complaint-management';
import { canUseIntake } from '@/lib/routing';
import type { ComplaintStatus, RoleName } from '@/types/database';

/**
 * POST /api/complaints/admin/[trackingId]/status
 *
 * Changes the status of a complaint with transition validation.
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
        { error: 'Only the assigned authority can update this complaint\'s status.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { status: newStatus, notes } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: 'status is required.' },
        { status: 400 },
      );
    }

    const validStatuses: ComplaintStatus[] = [
      'submitted',
      'assigned',
      'in_review',
      'action_taken',
      'resolved',
      'escalated',
      'reopened',
    ];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}` },
        { status: 400 },
      );
    }

    await changeComplaintStatus(
      {
        trackingId,
        newStatus: newStatus as ComplaintStatus,
        notes,
        actor: { userId: user.id, roles, universityId: profile.university_id },
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not change status.';
    console.error('[complaints/admin/status] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
