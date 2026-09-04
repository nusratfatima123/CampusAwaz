import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { FEEDBACK_RATING_MIN, FEEDBACK_RATING_MAX, FEEDBACK_COMMENT_MAX } from './constants';
import type { Feedback, RoleName } from '@/types/database';

/**
 * Server-side feedback helpers.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// Submit feedback
// ---------------------------------------------------------------------------

export interface SubmitFeedbackInput {
  trackingId: string;
  rating: number;
  comment?: string;
  studentId: string;
}

/**
 * Records student feedback for a resolved complaint.
 * One feedback per complaint (unique constraint on complaint_id).
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
  request?: Request,
): Promise<{ feedback: Feedback }> {
  if (input.rating < FEEDBACK_RATING_MIN || input.rating > FEEDBACK_RATING_MAX) {
    throw new Error(`Rating must be between ${FEEDBACK_RATING_MIN} and ${FEEDBACK_RATING_MAX}.`);
  }
  if (input.comment && input.comment.length > FEEDBACK_COMMENT_MAX) {
    throw new Error(`Comment must be under ${FEEDBACK_COMMENT_MAX} characters.`);
  }

  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, status')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.student_id !== input.studentId) throw new Error('You can only provide feedback for your own complaints.');
  if (complaint.status !== 'resolved') throw new Error('Feedback can only be submitted for resolved complaints.');

  // Check for existing feedback.
  const { data: existing } = await admin
    .from('feedback')
    .select('id')
    .eq('complaint_id', complaint.id)
    .maybeSingle();

  if (existing) throw new Error('You have already submitted feedback for this complaint.');

  const { data: feedbackRow, error } = await admin
    .from('feedback')
    .insert({
      complaint_id: complaint.id,
      student_id: input.studentId,
      rating: input.rating,
      comment: input.comment?.trim() ?? null,
    })
    .select('id, complaint_id, student_id, rating, comment, created_at')
    .single();

  if (error) throw new Error(`Failed to submit feedback: ${error.message}`);

  const feedback = feedbackRow as unknown as Feedback;

  await audit(AUDIT_EVENTS.FEEDBACK_SUBMITTED, {
    userId: input.studentId,
    actor: 'user',
    metadata: {
      tracking_id: complaint.tracking_id,
      feedback_id: feedback.id,
      rating: input.rating,
    },
    request,
  });

  return { feedback };
}

// ---------------------------------------------------------------------------
// Read feedback
// ---------------------------------------------------------------------------

export async function getFeedback(
  complaintId: string,
): Promise<Feedback | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('feedback')
    .select('id, complaint_id, student_id, rating, comment, created_at')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  return (data as unknown as Feedback) ?? null;
}

export async function getFeedbackByTrackingId(
  trackingId: string,
): Promise<Feedback | null> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id')
    .eq('tracking_id', trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) return null;
  return getFeedback((complaint as { id: string }).id);
}
