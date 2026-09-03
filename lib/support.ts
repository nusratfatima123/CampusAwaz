import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import {
  COUNSELING_SUBJECT_MIN,
  COUNSELING_SUBJECT_MAX,
  COUNSELING_MESSAGE_MIN,
  COUNSELING_MESSAGE_MAX,
} from './constants';
import type {
  CounselingRequest,
  CounselingStatus,
  EmergencyContact,
  RoleName,
  SupportResource,
  SupportResourceType,
} from '@/types/database';

/**
 * Server-side support, counseling, and emergency-contact helpers.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// Support Resources
// ---------------------------------------------------------------------------

export async function getSupportResources(
  universityId: string,
  resourceType?: SupportResourceType,
): Promise<SupportResource[]> {
  const admin = createAdminClient();

  let query = admin
    .from('support_resources')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SupportResource[];
}

// ---------------------------------------------------------------------------
// Emergency Contacts
// ---------------------------------------------------------------------------

export async function getEmergencyContacts(
  universityId: string,
): Promise<EmergencyContact[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('emergency_contacts')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmergencyContact[];
}

// ---------------------------------------------------------------------------
// Counseling Requests
// ---------------------------------------------------------------------------

export interface CreateCounselingRequestInput {
  studentId: string;
  universityId: string;
  subject: string;
  message: string;
}

export async function createCounselingRequest(
  input: CreateCounselingRequestInput,
  request?: Request,
): Promise<{ counselingRequest: CounselingRequest }> {
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (subject.length < COUNSELING_SUBJECT_MIN || subject.length > COUNSELING_SUBJECT_MAX) {
    throw new Error(
      `Subject must be between ${COUNSELING_SUBJECT_MIN} and ${COUNSELING_SUBJECT_MAX} characters.`,
    );
  }
  if (message.length < COUNSELING_MESSAGE_MIN || message.length > COUNSELING_MESSAGE_MAX) {
    throw new Error(
      `Message must be between ${COUNSELING_MESSAGE_MIN} and ${COUNSELING_MESSAGE_MAX} characters.`,
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('counseling_requests')
    .insert({
      student_id: input.studentId,
      university_id: input.universityId,
      subject,
      message,
      is_anonymous: true,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await audit(AUDIT_EVENTS.COUNSELING_REQUEST_CREATED, {
    userId: input.studentId,
    metadata: { requestId: (data as CounselingRequest).id },
    request,
  });

  return { counselingRequest: data as CounselingRequest };
}

export async function getCounselingRequestsForStudent(
  studentId: string,
): Promise<CounselingRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('counseling_requests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CounselingRequest[];
}

export async function getCounselingRequestsForCounselor(
  counselorId: string,
  universityId: string,
): Promise<CounselingRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('counseling_requests')
    .select('*')
    .eq('university_id', universityId)
    .eq('counselor_id', counselorId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CounselingRequest[];
}

export async function getPendingCounselingRequests(
  universityId: string,
): Promise<CounselingRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('counseling_requests')
    .select('*')
    .eq('university_id', universityId)
    .is('counselor_id', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CounselingRequest[];
}

export async function assignCounselingRequest(
  requestId: string,
  counselorId: string,
  actor: { userId: string; roles: RoleName[]; universityId: string },
  request?: Request,
): Promise<{ counselingRequest: CounselingRequest }> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('counseling_requests')
    .select('id, university_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error('Counseling request not found.');
  if ((existing as { university_id: string }).university_id !== actor.universityId) {
    throw new Error('Counseling request not found.');
  }

  const { data, error } = await admin
    .from('counseling_requests')
    .update({ counselor_id: counselorId, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await audit(AUDIT_EVENTS.COUNSELING_REQUEST_ASSIGNED, {
    userId: actor.userId,
    metadata: { requestId, counselorId },
    request,
  });

  return { counselingRequest: data as CounselingRequest };
}

export async function updateCounselingStatus(
  requestId: string,
  status: CounselingStatus,
  actor: { userId: string; roles: RoleName[]; universityId: string },
  request?: Request,
): Promise<{ counselingRequest: CounselingRequest }> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('counseling_requests')
    .select('id, university_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error('Counseling request not found.');
  if ((existing as { university_id: string }).university_id !== actor.universityId) {
    throw new Error('Counseling request not found.');
  }

  const { data, error } = await admin
    .from('counseling_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await audit(AUDIT_EVENTS.COUNSELING_STATUS_CHANGED, {
    userId: actor.userId,
    metadata: { requestId, fromStatus: (existing as { status: string }).status, toStatus: status },
    request,
  });

  return { counselingRequest: data as CounselingRequest };
}
