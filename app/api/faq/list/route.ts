import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFaqEntries } from '@/lib/faq';

/**
 * GET /api/faq/list
 *
 * Returns active FAQ entries for the caller's university.
 * Optional `?category=` query param filters by category_key.
 */
export async function GET(request: Request) {
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

    if (!profile?.university_id) {
      return NextResponse.json(
        { error: 'Select your university first.' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;

    const entries = await getFaqEntries(profile.university_id, category);

    return NextResponse.json({ success: true, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load FAQs.';
    console.error('[faq/list] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
