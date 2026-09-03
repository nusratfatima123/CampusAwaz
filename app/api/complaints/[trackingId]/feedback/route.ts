import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitFeedback } from '@/lib/feedback';

/**
 * POST /api/complaints/[trackingId]/feedback
 *
 * Student submits feedback (rating + optional comment) for a resolved complaint.
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

    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5.' },
        { status: 400 },
      );
    }

    const result = await submitFeedback(
      {
        trackingId,
        rating,
        comment: comment?.trim() || undefined,
        studentId: user.id,
      },
      request,
    );

    return NextResponse.json({
      success: true,
      feedback: result.feedback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not submit feedback.';
    console.error('[complaints/feedback] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
