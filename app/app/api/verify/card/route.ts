import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { extractStudentCard, getOcrProvider } from '@/lib/ocr';
import { validateCardFile, extensionForMime } from '@/lib/validators';
import { getOcrConfidenceThreshold } from '@/lib/constants';
import { statusAfterCardProcessed } from '@/lib/verification';

const BUCKET = 'student-cards';

export async function POST(request: Request) {
  // --- Auth ----------------------------------------------------------------
  let user: { id: string; email?: string | undefined } | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser ?? null;
  } catch (err) {
    console.error(
      '[verify/card] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  // --- Read the multipart body --------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid upload. Expected multipart form data.' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Select a file to upload.' }, { status: 400 });
  }

  // --- Server-side validation (never trust the client) ---------------------
  const fileCheck = validateCardFile({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (!fileCheck.valid) {
    return NextResponse.json({ error: fileCheck.error }, { status: 400 });
  }

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // --- Upload to the private bucket ---------------------------------------
  const extension = extensionForMime(file.type);
  const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[verify/card] upload failed:', uploadError.message);
    return NextResponse.json(
      {
        error:
          'Could not store your file. Confirm the "student-cards" bucket exists, then try again.',
      },
      { status: 500 }
    );
  }

  await audit(AUDIT_EVENTS.VERIFICATION_CARD_UPLOADED, {
    userId: user.id,
    actor: 'user',
    metadata: {
      storage_path: objectPath,
      mime: file.type,
      size_bytes: file.size,
    },
    request,
  });

  // --- OCR -----------------------------------------------------------------
  const ocr = await extractStudentCard(buffer, file.type, { filename: file.name });
  const threshold = getOcrConfidenceThreshold();

  /*
   * Per the SRS the student card is a supplementary check, so a low-confidence
   * read still grants access — it is simply flagged for an admin to revisit.
   */
  const needsManualReview = ocr.needs_manual_review || ocr.confidence < threshold;

  const { data: inserted, error: insertError } = await admin
    .from('user_verification')
    .insert({
      user_id: user.id,
      method: 'student_card',
      status: 'verified',
      card_storage_path: objectPath,
      ocr_extracted: {
        name: ocr.name,
        roll_id: ocr.roll_id,
        university: ocr.university,
        validity: ocr.validity,
      },
      ocr_confidence: ocr.confidence,
      needs_manual_review: needsManualReview,
      verified_at: new Date().toISOString(),
      reviewer_notes: needsManualReview
        ? `Automatic confidence ${ocr.confidence.toFixed(2)} is below the ${threshold.toFixed(2)} threshold.`
        : null,
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.error('[verify/card] insert failed:', insertError.message);
    return NextResponse.json(
      { error: 'Could not save the verification result. Please try again.' },
      { status: 500 }
    );
  }

  await audit(AUDIT_EVENTS.VERIFICATION_CARD_OCR_COMPLETED, {
    userId: user.id,
    actor: 'system',
    metadata: {
      provider: getOcrProvider(),
      confidence: ocr.confidence,
      threshold,
      needs_manual_review: needsManualReview,
    },
    request,
  });

  // --- Advance the state machine ------------------------------------------
  await admin
    .from('profiles')
    .update({ affiliation_status: statusAfterCardProcessed() })
    .eq('id', user.id);

  await audit(AUDIT_EVENTS.VERIFICATION_APPROVED, {
    userId: user.id,
    actor: 'system',
    metadata: { method: 'student_card', needs_manual_review: needsManualReview },
    request,
  });

  // Short-lived signed URL so the client can preview the private object.
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, 300);

  return NextResponse.json({
    success: true,
    verification_id: inserted?.id ?? null,
    affiliation_status: 'verified',
    needs_manual_review: needsManualReview,
    threshold,
    ocr: {
      name: ocr.name ?? null,
      roll_id: ocr.roll_id ?? null,
      university: ocr.university ?? null,
      validity: ocr.validity ?? null,
      confidence: ocr.confidence,
    },
    preview_url: signed?.signedUrl ?? null,
  });
}
