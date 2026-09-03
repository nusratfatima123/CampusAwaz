import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadResolutionEvidence } from '@/lib/resolution';
import { canUseIntake } from '@/lib/routing';
import {
  RESOLUTION_EVIDENCE_BUCKET,
  ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES,
  MAX_RESOLUTION_EVIDENCE_BYTES,
  MAX_RESOLUTION_EVIDENCE_FILES,
} from '@/lib/constants';
import { extensionForMime } from '@/lib/validators';
import type { RoleName } from '@/types/database';

/**
 * POST /api/complaints/admin/[trackingId]/resolution/evidence/upload
 *
 * Accepts up to 5 files as multipart/form-data, uploads them to the
 * `resolution-evidence` storage bucket, and records the references in the
 * `resolution_evidence` table.
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

    const admin = createAdminClient();

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from('user_roles').select('roles ( name )').eq('user_id', user.id),
      admin
        .from('profiles')
        .select('id, university_id')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const roles = ((roleRows ?? []) as unknown as { roles: { name: RoleName } | null }[])
      .map((row) => row.roles?.name)
      .filter((name): name is RoleName => Boolean(name));

    if (!canUseIntake(roles) || !profile?.university_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const is_admin = roles.includes('admin');
    if (!is_admin) {
      const { data: complaint } = await admin
        .from('complaints')
        .select('assigned_to')
        .eq('tracking_id', trackingId)
        .eq('university_id', profile.university_id)
        .maybeSingle();

      if (!complaint || complaint.assigned_to !== user.id) {
        return NextResponse.json(
          { error: 'You are not assigned to this complaint.' },
          { status: 403 },
        );
      }
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid upload. Expected multipart form data.' },
        { status: 400 },
      );
    }

    const rawFiles: File[] = [];
    for (let i = 0; i < MAX_RESOLUTION_EVIDENCE_FILES; i++) {
      const file = formData.get(`file${i === 0 ? '' : i}`);
      if (file instanceof File) rawFiles.push(file);
    }

    if (rawFiles.length === 0) {
      const single = formData.get('file');
      if (single instanceof File) rawFiles.push(single);
    }

    if (rawFiles.length === 0) {
      return NextResponse.json({ error: 'No files provided.' }, { status: 400 });
    }

    if (rawFiles.length > MAX_RESOLUTION_EVIDENCE_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_RESOLUTION_EVIDENCE_FILES} files allowed.` },
        { status: 400 },
      );
    }

    for (const file of rawFiles) {
      if (
        !ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES)[number],
        )
      ) {
        return NextResponse.json(
          { error: `File "${file.name}" has an unsupported type (${file.type || 'unknown'}).` },
          { status: 400 },
        );
      }
      if (file.size > MAX_RESOLUTION_EVIDENCE_BYTES) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 5 MB limit.` },
          { status: 400 },
        );
      }
    }

    const uploaded: {
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      storagePath: string;
    }[] = [];

    for (const file of rawFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${user.id}/${trackingId.toUpperCase()}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;

      const { error } = await admin.storage
        .from(RESOLUTION_EVIDENCE_BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: false });

      if (error) {
        console.error('[resolution/evidence] storage upload failed:', error.message);
        return NextResponse.json(
          {
            error: `Could not store "${file.name}". Confirm the "${RESOLUTION_EVIDENCE_BUCKET}" bucket exists, then try again.`,
          },
          { status: 500 },
        );
      }

      uploaded.push({
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        storagePath,
      });
    }

    const result = await uploadResolutionEvidence(
      {
        trackingId,
        files: uploaded,
        actor: { userId: user.id, roles, universityId: profile.university_id },
      },
      request,
    );

    return NextResponse.json({
      success: true,
      evidence: result.evidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    console.error('[resolution/evidence] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
