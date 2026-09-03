import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createCounselingRequest,
  getCounselingRequestsForStudent,
} from '@/lib/support';
import type { RoleName } from '@/types/database';

/**
 * GET /api/support/counseling
 *
 * Lists the caller's counseling requests (student) or assigned requests (counselor).
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
      admin.from('profiles').select('university_id').eq('id', user.id).maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    const universityId = (profile as { university_id: string } | null)?.university_id;
    if (!universityId) {
      return NextResponse.json({ error: 'No university linked.' }, { status: 400 });
    }

    const isCounselor = roles.includes('counselor');

    let requests;
    if (isCounselor) {
      const { getCounselingRequestsForCounselor } = await import('@/lib/support');
      requests = await getCounselingRequestsForCounselor(user.id, universityId);
    } else {
      requests = await getCounselingRequestsForStudent(user.id);
    }

    return NextResponse.json({ success: true, requests });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch requests.';
    console.error('[support/counseling] GET failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * POST /api/support/counseling
 *
 * Creates a new anonymous counseling request.
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
    const { data: profile } = await admin
      .from('profiles')
      .select('university_id')
      .eq('id', user.id)
      .maybeSingle();

    const universityId = (profile as { university_id: string } | null)?.university_id;
    if (!universityId) {
      return NextResponse.json({ error: 'No university linked.' }, { status: 400 });
    }

    const body = await request.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required.' },
        { status: 400 },
      );
    }

    const result = await createCounselingRequest(
      {
        studentId: user.id,
        universityId,
        subject,
        message,
      },
      request,
    );

    return NextResponse.json({
      success: true,
      counselingRequest: result.counselingRequest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create request.';
    console.error('[support/counseling] POST failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
