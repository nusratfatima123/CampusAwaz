import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { EVIDENCE_BUCKET } from '@/lib/constants';

/**
 * GET /api/complaints/preflight
 *
 * Checks that all prerequisites for complaint submission are met:
 *   1. User is authenticated and verified.
 *   2. The complaint-evidence storage bucket exists.
 *   3. The generate_tracking_id function is callable.
 *
 * Returns a JSON object with status for each check and an overall ready flag.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ready: false, checks: { auth: { ok: false, detail: 'Not authenticated.' } } },
        { status: 401 },
      );
    }

    checks.auth = { ok: true, detail: 'Authenticated.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliation_status, university_id')
      .eq('id', user.id)
      .maybeSingle();

    const verified = profile?.affiliation_status === 'verified';
    checks.verification = {
      ok: verified,
      detail: verified
        ? 'University verified.'
        : 'University affiliation not verified. Complete verification before submitting.',
    };

    checks.university = {
      ok: Boolean(profile?.university_id),
      detail: profile?.university_id
        ? 'University selected.'
        : 'No university selected. Select your university before submitting.',
    };

    const admin = createAdminClient();

    const { error: listError } = await admin.storage.from(EVIDENCE_BUCKET).list('', {
      limit: 1,
    });
    if (listError) {
      const msg = listError.message?.toLowerCase() ?? '';
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('bucket')) {
        checks.storageBucket = {
          ok: false,
          detail: `"${EVIDENCE_BUCKET}" bucket not found. Run migration 011_fix_complaint_submission.sql.`,
        };
      } else {
        checks.storageBucket = {
          ok: true,
          detail: `"${EVIDENCE_BUCKET}" bucket exists (list returned: ${listError.message}).`,
        };
      }
    } else {
      checks.storageBucket = {
        ok: true,
        detail: `"${EVIDENCE_BUCKET}" bucket exists.`,
      };
    }

    if (profile?.university_id) {
      const { error: rpcError } = await admin.rpc('generate_tracking_id', {
        p_university_id: profile.university_id,
        p_year: new Date().getUTCFullYear(),
      });

      if (rpcError) {
        const msg = rpcError.message.toLowerCase();
        if (msg.includes('permission denied')) {
          checks.trackingIdFunction = {
            ok: false,
            detail:
              'Permission denied for generate_tracking_id. Run migration 011_fix_complaint_submission.sql.',
          };
        } else {
          checks.trackingIdFunction = {
            ok: false,
            detail: `generate_tracking_id check failed: ${rpcError.message}`,
          };
        }
      } else {
        checks.trackingIdFunction = {
          ok: true,
          detail: 'generate_tracking_id is callable.',
        };
      }
    } else {
      checks.trackingIdFunction = {
        ok: false,
        detail: 'Skipped — no university selected.',
      };
    }
  } catch (err) {
    return NextResponse.json(
      {
        ready: false,
        checks: {
          server: {
            ok: false,
            detail: `Server error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          },
        },
      },
      { status: 500 },
    );
  }

  const ready = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({ ready, checks });
}
