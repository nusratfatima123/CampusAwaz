import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import { createNotification } from './notifications';
import { changeComplaintStatus } from './complaint-management';
import {
  RESOLUTION_EVIDENCE_BUCKET,
  ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES,
  MAX_RESOLUTION_EVIDENCE_BYTES,
  MAX_RESOLUTION_EVIDENCE_FILES,
  RESOLUTION_EVIDENCE_SIGNED_URL_TTL_SECONDS,
} from './constants';
import type {
  ProofOfAction,
  ResolutionEvidence,
  RoleName,
} from '@/types/database';

/**
 * Server-side resolution & proof-of-action helpers.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// Proof of Action
// ---------------------------------------------------------------------------

export interface CreateProofOfActionInput {
  trackingId: string;
  actionTaken: string;
  resolutionExplanation?: string;
  actor: { userId: string; roles: RoleName[]; universityId: string };
}

/**
 * Records the action taken when resolving a complaint and transitions the
 * complaint through action_taken → resolved.
 */
export async function createProofOfAction(
  input: CreateProofOfActionInput,
  request?: Request,
): Promise<{ proofOfAction: ProofOfAction }> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, student_id, university_id, status, is_sensitive, assigned_to')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.university_id !== input.actor.universityId) throw new Error('Complaint not found.');

  if (!['in_review', 'assigned'].includes(complaint.status)) {
    throw new Error(`Cannot resolve from status "${complaint.status}".`);
  }

  // Insert proof of action.
  const { data: proofRow, error } = await admin
    .from('proof_of_action')
    .insert({
      complaint_id: complaint.id,
      created_by: input.actor.userId,
      action_taken: input.actionTaken,
      resolution_explanation: input.resolutionExplanation ?? null,
    })
    .select('id, complaint_id, created_by, action_taken, resolution_explanation, created_at')
    .single();

  if (error) throw new Error(`Failed to create proof of action: ${error.message}`);

  const proofOfAction = proofRow as unknown as ProofOfAction;

  // Transition: first to action_taken, then to resolved.
  await changeComplaintStatus(
    {
      trackingId: input.trackingId,
      newStatus: 'action_taken',
      notes: input.resolutionExplanation ?? input.actionTaken,
      actor: input.actor,
    },
    request,
  );

  await changeComplaintStatus(
    {
      trackingId: input.trackingId,
      newStatus: 'resolved',
      notes: input.resolutionExplanation ?? input.actionTaken,
      actor: input.actor,
    },
    request,
  );

  // Notify student.
  await createNotification(
    {
      userId: complaint.student_id,
      type: 'resolution',
      complaintId: complaint.id,
      title: 'Your complaint has been resolved',
      body: `Action taken: ${input.actionTaken}`,
      trackingId: complaint.tracking_id,
    },
    request,
  );

  await audit(AUDIT_EVENTS.PROOF_OF_ACTION_CREATED, {
    userId: input.actor.userId,
    actor: 'admin',
    metadata: {
      tracking_id: complaint.tracking_id,
      proof_id: proofOfAction.id,
      action_taken: input.actionTaken,
    },
    request,
  });

  return { proofOfAction };
}

// ---------------------------------------------------------------------------
// Resolution evidence
// ---------------------------------------------------------------------------

export interface UploadResolutionEvidenceInput {
  trackingId: string;
  files: {
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    storagePath: string;
  }[];
  actor: { userId: string; roles: RoleName[]; universityId: string };
}

/**
 * Records resolution evidence file references after upload to the storage bucket.
 */
export async function uploadResolutionEvidence(
  input: UploadResolutionEvidenceInput,
  request?: Request,
): Promise<{ evidence: ResolutionEvidence[] }> {
  const admin = createAdminClient();

  if (input.files.length > MAX_RESOLUTION_EVIDENCE_FILES) {
    throw new Error(`Maximum ${MAX_RESOLUTION_EVIDENCE_FILES} files allowed.`);
  }

  for (const file of input.files) {
    if (!ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES.includes(file.fileType as typeof ALLOWED_RESOLUTION_EVIDENCE_MIME_TYPES[number])) {
      throw new Error(`File type "${file.fileType}" is not allowed.`);
    }
    if (file.fileSizeBytes > MAX_RESOLUTION_EVIDENCE_BYTES) {
      throw new Error(`File "${file.fileName}" exceeds the 5 MB limit.`);
    }
  }

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, tracking_id, university_id')
    .eq('tracking_id', input.trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.university_id !== input.actor.universityId) throw new Error('Complaint not found.');

  const rows = input.files.map((f) => ({
    complaint_id: complaint.id,
    uploaded_by: input.actor.userId,
    storage_path: f.storagePath,
    file_name: f.fileName,
    file_type: f.fileType,
    file_size_bytes: f.fileSizeBytes,
  }));

  const { data: inserted, error } = await admin
    .from('resolution_evidence')
    .insert(rows)
    .select('id, complaint_id, uploaded_by, storage_path, file_name, file_type, file_size_bytes, created_at');

  if (error) throw new Error(`Failed to save resolution evidence: ${error.message}`);

  const evidence = (inserted ?? []) as unknown as ResolutionEvidence[];

  await audit(AUDIT_EVENTS.RESOLUTION_EVIDENCE_UPLOADED, {
    userId: input.actor.userId,
    actor: 'admin',
    metadata: {
      tracking_id: complaint.tracking_id,
      file_count: evidence.length,
    },
    request,
  });

  return { evidence };
}

/**
 * Returns signed URLs for resolution evidence files.
 */
export async function getResolutionEvidenceSignedUrls(
  trackingId: string,
  userId: string,
): Promise<{ id: string; fileName: string; fileType: string; url: string }[]> {
  const admin = createAdminClient();

  const { data: complaint } = await admin
    .from('complaints')
    .select('id, student_id')
    .eq('tracking_id', trackingId.trim().toUpperCase())
    .maybeSingle();

  if (!complaint) return [];

  const { data: evidence } = await admin
    .from('resolution_evidence')
    .select('id, storage_path, file_name, file_type')
    .eq('complaint_id', complaint.id)
    .order('created_at', { ascending: true });

  if (!evidence || evidence.length === 0) return [];

  const results = await Promise.all(
    (evidence as { id: string; storage_path: string; file_name: string; file_type: string }[]).map(
      async (e) => {
        const { data: urlData } = await admin.storage
          .from(RESOLUTION_EVIDENCE_BUCKET)
          .createSignedUrl(e.storage_path, RESOLUTION_EVIDENCE_SIGNED_URL_TTL_SECONDS);

        return {
          id: e.id,
          fileName: e.file_name,
          fileType: e.file_type,
          url: urlData?.signedUrl ?? '',
        };
      },
    ),
  );

  return results.filter((r) => r.url);
}

/**
 * Returns resolution evidence rows (without signed URLs) for a complaint.
 */
export async function getResolutionEvidence(
  complaintId: string,
): Promise<ResolutionEvidence[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('resolution_evidence')
    .select('id, complaint_id, uploaded_by, storage_path, file_name, file_type, file_size_bytes, created_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as ResolutionEvidence[];
}
