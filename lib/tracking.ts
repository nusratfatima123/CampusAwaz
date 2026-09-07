import { createAdminClient } from './supabase/admin';

/**
 * Human-readable complaint tracking identifiers.
 *
 * Format: `CA-{UNIVERSITY_CODE}-{YYYY}-{SEQUENCE}` — e.g. `CA-FAST-2026-00001`.
 * The sequence is per-university-per-year and is allocated atomically by the
 * `public.generate_tracking_id` Postgres function (INSERT … ON CONFLICT DO
 * UPDATE … RETURNING), so concurrent submissions can never collide.
 *
 * SERVER ONLY — this uses the service-role client.
 */

/** Regex the generated ids always satisfy. Useful for tests and guards. */
export const TRACKING_ID_PATTERN = /^CA-[A-Z0-9-]{2,20}-\d{4}-\d{5,}$/;

export async function generateTrackingId(
  universityId: string,
  year: number = new Date().getUTCFullYear()
): Promise<string> {
  if (!universityId) {
    throw new Error('A university is required before a tracking ID can be issued.');
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('generate_tracking_id', {
    p_university_id: universityId,
    p_year: year,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('permission denied') || msg.includes('pg_insufficient_privilege')) {
      throw new Error(
        'Tracking ID generation is not permitted. ' +
        'Run migration 011_fix_complaint_submission.sql in the Supabase SQL editor ' +
        'to grant the required permissions.'
      );
    }
    if (msg.includes('function') && msg.includes('does not exist')) {
      throw new Error(
        'The tracking ID function is missing. ' +
        'Run migration 002_complaints.sql in the Supabase SQL editor.'
      );
    }
    throw new Error(`Could not allocate a tracking ID: ${error.message}`);
  }

  const trackingId = typeof data === 'string' ? data : null;
  if (!trackingId || !TRACKING_ID_PATTERN.test(trackingId)) {
    throw new Error('The database returned an unexpected tracking ID.');
  }

  return trackingId;
}

/** Splits a tracking id into its parts, or null when the shape is wrong. */
export function parseTrackingId(trackingId: string): {
  universityCode: string;
  year: number;
  sequence: number;
} | null {
  const match = /^CA-(.+)-(\d{4})-(\d{5,})$/.exec(trackingId.trim().toUpperCase());
  if (!match) return null;
  return {
    universityCode: match[1]!,
    year: Number.parseInt(match[2]!, 10),
    sequence: Number.parseInt(match[3]!, 10),
  };
}
