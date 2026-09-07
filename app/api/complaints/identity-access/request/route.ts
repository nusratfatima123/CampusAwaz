import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestIdentityAccess } from '@/lib/identity-access';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/identity-access/request
 *
 * Authority (staff) requests access to the reporter's identity.
 * Body: { complaintId: string }
 */
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

    const isStaff = roles.some((r) =>
      ['admin', 'hod', 'proctor', 'female_focal_person', 'hostel_warden', 'counselor'].includes(r),
    );

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { complaintId, reason } = body;

    if (!complaintId) {
      return NextResponse.json({ error: 'complaintId is required.' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'A reason of at least 10 characters is required.' },
        { status: 400 },
      );
    }

    // Verify the authority is assigned to this complaint.
    const { data: assignment } = await admin
      .from('complaint_assignments')
      .select('id, assigned_to')
      .eq('complaint_id', complaintId)
      .eq('assigned_to', user.id)
      .maybeSingle();

    if (!assignment) {
      return NextResponse.json(
        { error: 'You are not assigned to this complaint.' },
        { status: 403 },
      );
    }

    const role = roles.find((r) => r !== 'admin') ?? roles[0] ?? 'admin';

    const result = await requestIdentityAccess(
      { complaintId, requesterId: user.id, role, reason: reason.trim() },
      request,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create request.';
    console.error('[identity-access/request] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
