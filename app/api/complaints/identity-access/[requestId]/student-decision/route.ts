import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  grantIdentityRequest,
  denyIdentityRequestByStudent,
} from '@/lib/identity-access';

/**
 * POST /api/complaints/identity-access/[requestId]/student-decision
 *
 * Student grants or denies an identity access request.
 * Body: { action: 'grant' | 'deny', notes?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify the user is the complaint owner.
    const { data: req } = await admin
      .from('identity_access_requests')
      .select('complaint_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    const { data: complaint } = await admin
      .from('complaints')
      .select('student_id')
      .eq('id', req.complaint_id)
      .maybeSingle();

    if (!complaint || complaint.student_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, notes } = body;

    if (action !== 'grant' && action !== 'deny') {
      return NextResponse.json(
        { error: 'action must be "grant" or "deny".' },
        { status: 400 },
      );
    }

    if (action === 'grant') {
      const result = await grantIdentityRequest(requestId, notes, request);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else {
      const result = await denyIdentityRequestByStudent(requestId, notes, request);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not process decision.';
    console.error('[identity-access/student-decision] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
