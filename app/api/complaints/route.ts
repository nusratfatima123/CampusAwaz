import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createComplaint,
  getStudentComplaints,
  uploadEvidence,
} from '@/lib/complaints';
import {
  isUuid,
  validateComplaintDescription,
  validateComplaintTitle,
  validateEvidenceSet,
  validatePriority,
  validatePrivacyMode,
} from '@/lib/validators';
import { MAX_EVIDENCE_FILES } from '@/lib/constants';
import type { ComplaintPriority, PrivacyMode } from '@/types/database';

/**
 * Complaint collection endpoint.
 *
 *   POST /api/complaints  — create a complaint (multipart: fields + evidence)
 *   GET  /api/complaints  — list the caller's own complaints
 *
 * All privileged work happens here with the service-role client; the browser
 * never touches the complaints tables directly.
 */

async function requireVerifiedStudent() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, affiliation_status, university_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.affiliation_status !== 'verified') {
    return {
      error: NextResponse.json(
        { error: 'Verify your university affiliation before submitting a complaint.' },
        { status: 403 }
      ),
    };
  }

  return { user, profile };
}

export async function POST(request: Request) {
  let guard: Awaited<ReturnType<typeof requireVerifiedStudent>>;
  try {
    guard = await requireVerifiedStudent();
  } catch (err) {
    console.error(
      '[complaints] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }
  if (guard.error) return guard.error;
  const user = guard.user!;

  // --- Parse the multipart body -------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request. Expected multipart form data.' },
      { status: 400 }
    );
  }

  const categoryId = String(formData.get('category_id') ?? '').trim();
  const title = String(formData.get('title') ?? '');
  const description = String(formData.get('description') ?? '');
  const privacyMode = String(formData.get('privacy_mode') ?? 'identified');
  const immediateDanger = String(formData.get('immediate_danger') ?? '') === 'true';

  // --- Sprint 3: optional AI recommendation the student reviewed ------------
  const rawRecommendationId = String(
    formData.get('ai_recommendation_id') ?? ''
  ).trim();
  const aiWasEdited = String(formData.get('ai_was_edited') ?? '') === 'true';
  const rawAiPriority = String(formData.get('ai_priority') ?? '').trim();

  if (rawRecommendationId && !isUuid(rawRecommendationId)) {
    return NextResponse.json(
      { error: 'Invalid AI recommendation reference.' },
      { status: 400 }
    );
  }

  if (rawAiPriority && !validatePriority(rawAiPriority).valid) {
    return NextResponse.json({ error: 'Select a valid priority.' }, { status: 400 });
  }

  if (!categoryId) {
    return NextResponse.json({ error: 'Select a category.' }, { status: 400 });
  }

  const titleCheck = validateComplaintTitle(title);
  if (!titleCheck.valid) {
    return NextResponse.json({ error: titleCheck.error }, { status: 400 });
  }

  const descriptionCheck = validateComplaintDescription(description);
  if (!descriptionCheck.valid) {
    return NextResponse.json({ error: descriptionCheck.error }, { status: 400 });
  }

  const privacyCheck = validatePrivacyMode(privacyMode);
  if (!privacyCheck.valid) {
    return NextResponse.json({ error: privacyCheck.error }, { status: 400 });
  }

  // --- Evidence: re-validate every file server-side ------------------------
  const files = formData
    .getAll('evidence')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > MAX_EVIDENCE_FILES) {
    return NextResponse.json(
      { error: `You can attach at most ${MAX_EVIDENCE_FILES} files.` },
      { status: 400 }
    );
  }

  const setCheck = validateEvidenceSet(
    files.map((f) => ({ type: f.type, size: f.size, name: f.name }))
  );
  if (!setCheck.valid) {
    return NextResponse.json({ error: setCheck.error }, { status: 400 });
  }

  // --- Upload, then create -------------------------------------------------
  try {
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadEvidence(file, user.id));
    }

    const result = await createComplaint(
      {
        categoryId,
        title,
        description,
        privacyMode: privacyMode as PrivacyMode,
        immediateDanger,
        evidence: uploaded,
        aiRecommendationId: rawRecommendationId || null,
        aiWasEdited,
        aiPriority: (rawAiPriority as ComplaintPriority) || null,
      },
      user.id,
      request
    );

    return NextResponse.json({
      success: true,
      tracking_id: result.trackingId,
      status: result.status,
      is_sensitive: result.isSensitive,
      ai_recommended: result.aiRecommended,
      ai_recommendation_id: result.aiRecommendationId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not submit your complaint.';
    console.error('[complaints] create failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  let guard: Awaited<ReturnType<typeof requireVerifiedStudent>>;
  try {
    guard = await requireVerifiedStudent();
  } catch {
    return NextResponse.json(
      { error: 'Server is not configured.' },
      { status: 503 }
    );
  }
  if (guard.error) return guard.error;

  const complaints = await getStudentComplaints(guard.user!.id);

  return NextResponse.json({
    success: true,
    complaints: complaints.map((c) => ({
      tracking_id: c.tracking_id,
      title: c.title,
      status: c.status,
      privacy_mode: c.privacy_mode,
      is_sensitive: c.is_sensitive,
      category: c.complaint_categories?.label ?? null,
      category_key: c.complaint_categories?.key ?? null,
      submitted_at: c.submitted_at,
    })),
  });
}
