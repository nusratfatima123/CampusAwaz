import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResolutionEvidenceSignedUrls } from '@/lib/resolution';
import { getFeedbackByTrackingId } from '@/lib/feedback';

/**
 * GET /api/complaints/[trackingId]/resolution
 *
 * Returns proof of action, resolution evidence (with signed URLs), and feedback
 * for a complaint. Accessible by the student who owns it or staff with access.
 */
export async function GET(
  _request: Request,
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

    const { data: complaint } = await admin
      .from('complaints')
      .select('id, tracking_id, student_id, status, university_id')
      .eq('tracking_id', trackingId.trim().toUpperCase())
      .maybeSingle();

    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
    }

    const typed = complaint as { id: string; tracking_id: string; student_id: string; status: string; university_id: string | null };

    // Only the student or staff can view.
    const isOwner = typed.student_id === user.id;
    if (!isOwner) {
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
        admin.from('profiles').select('university_id').eq('id', user.id).maybeSingle(),
      ]);

      const roles = ((roleRows ?? []) as unknown as { roles: { name: string } | null }[])
        .map((r) => r.roles?.name)
        .filter(Boolean);

      const staffRoles = ['admin', 'hod', 'proctor', 'female_focal_person', 'counselor'];
      if (!roles.some((r) => staffRoles.includes(r!)) || (profile as { university_id: string } | null)?.university_id !== typed.university_id) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
    }

    // Fetch proof of action.
    const { data: proofRows } = await admin
      .from('proof_of_action')
      .select('id, complaint_id, created_by, action_taken, resolution_explanation, created_at')
      .eq('complaint_id', typed.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const proofOfAction = (proofRows ?? [])[0] ?? null;

    // Fetch resolution evidence with signed URLs.
    const evidence = await getResolutionEvidenceSignedUrls(trackingId, user.id);

    // Fetch feedback.
    const feedback = await getFeedbackByTrackingId(trackingId);

    return NextResponse.json({
      complaintId: typed.id,
      status: typed.status,
      proofOfAction,
      resolutionEvidence: evidence,
      feedback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not fetch resolution data.';
    console.error('[complaints/resolution] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
