import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEvidenceSignedUrls } from '@/lib/complaints';
import { isTrackingIdShape } from '@/lib/validators';
import { EVIDENCE_SIGNED_URL_TTL_SECONDS } from '@/lib/constants';

/**
 * GET /api/complaints/[trackingId]/evidence
 *
 * Returns 1-hour signed URLs for the private `complaint-evidence` objects that
 * belong to a complaint the caller owns.
 */
export async function GET(
  _request: Request,
  { params }: { params: { trackingId: string } }
) {
  let userId: string | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const trackingId = decodeURIComponent(params.trackingId ?? '');
  if (!isTrackingIdShape(trackingId)) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  const evidence = await getEvidenceSignedUrls(trackingId, userId);
  if (!evidence) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    expires_in: EVIDENCE_SIGNED_URL_TTL_SECONDS,
    evidence,
  });
}
