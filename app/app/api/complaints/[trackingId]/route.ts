import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getComplaintByTrackingId } from '@/lib/complaints';
import { isTrackingIdShape } from '@/lib/validators';

/**
 * GET /api/complaints/[trackingId]
 *
 * Sprint 2 scope: the reporting student only. Staff-facing case views land with
 * the admin dashboards, so a non-owner receives 404 (not 403) to avoid leaking
 * whether a tracking ID exists.
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

  const detail = await getComplaintByTrackingId(trackingId, userId);
  if (!detail) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  const { complaint, evidence, history, privacy, aiRecommendation } = detail;

  return NextResponse.json({
    success: true,
    complaint: {
      tracking_id: complaint.tracking_id,
      title: complaint.title,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      privacy_mode: complaint.privacy_mode,
      is_sensitive: complaint.is_sensitive,
      immediate_danger: complaint.immediate_danger,
      submitted_at: complaint.submitted_at,
      updated_at: complaint.updated_at,
      category: complaint.complaint_categories?.label ?? null,
      category_key: complaint.complaint_categories?.key ?? null,
      anonymous_alias: privacy?.anonymous_alias ?? null,
    },
    evidence: evidence.map((item) => ({
      id: item.id,
      file_name: item.file_name,
      file_type: item.file_type,
      file_size_bytes: item.file_size_bytes,
      created_at: item.created_at,
    })),
    history: history.map((item) => ({
      status: item.status,
      notes: item.notes,
      created_at: item.created_at,
    })),
    // Sprint 3 — the recommendation the reporter reviewed before submitting.
    ai_recommendations: aiRecommendation
      ? [
          {
            id: aiRecommendation.id,
            category_key: aiRecommendation.category_key,
            subcategory: aiRecommendation.subcategory,
            priority: aiRecommendation.priority,
            department_key: aiRecommendation.department_key,
            confidence: {
              category: Number(aiRecommendation.category_confidence),
              priority: Number(aiRecommendation.priority_confidence),
              department: Number(aiRecommendation.department_confidence),
              overall: Number(aiRecommendation.overall_confidence),
            },
            model_used: aiRecommendation.model_used,
            was_edited: aiRecommendation.was_edited,
            admin_reviewed: Boolean(aiRecommendation.admin_override),
            created_at: aiRecommendation.created_at,
          },
        ]
      : [],
  });
}
