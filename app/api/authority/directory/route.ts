import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthorityDirectory } from '@/lib/authority';

/**
 * GET /api/authority/directory
 * Public directory of approved authorities at the caller's university.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('university_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.university_id) {
      return NextResponse.json({ directory: [] });
    }

    const directory = await getAuthorityDirectory(profile.university_id);
    return NextResponse.json({ directory });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch directory.';
    console.error('[authority/directory] GET failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
