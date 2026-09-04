import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadEvidence } from '@/lib/complaints';
import { validateEvidenceFile } from '@/lib/validators';

/**
 * POST /api/complaints/evidence/upload
 *
 * Uploads a single file to the private `complaint-evidence` bucket under
 * `{userId}/staged/…` and returns its storage path. Used for upload-as-you-go
 * flows; the standard form submits files inline with `POST /api/complaints`.
 *
 * Only verified students may upload, and the path is always namespaced by the
 * caller's own user id so a client cannot write into somebody else's folder.
 */
export async function POST(request: Request) {
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

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('affiliation_status')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.affiliation_status !== 'verified') {
    return NextResponse.json(
      { error: 'Verify your university affiliation before uploading evidence.' },
      { status: 403 }
    );
  }

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

  const check = validateEvidenceFile({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (!check.valid) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  try {
    const uploaded = await uploadEvidence(file, userId);
    return NextResponse.json({
      success: true,
      storage_path: uploaded.path,
      file_name: uploaded.name,
      file_type: uploaded.type,
      file_size_bytes: uploaded.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
