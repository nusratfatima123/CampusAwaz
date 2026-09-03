import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmergencyContacts } from '@/lib/support';

/**
 * GET /api/support/emergency
 *
 * Lists active emergency contacts for the caller's university.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('university_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!(profile as { university_id: string } | null)?.university_id) {
      return NextResponse.json({ error: 'No university linked.' }, { status: 400 });
    }

    const contacts = await getEmergencyContacts(
      (profile as { university_id: string }).university_id,
    );

    return NextResponse.json({ success: true, contacts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch contacts.';
    console.error('[support/emergency] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
