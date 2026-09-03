import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSupportResources } from '@/lib/support';
import type { SupportResourceType } from '@/types/database';

/**
 * GET /api/support/resources
 *
 * Lists active support resources for the caller's university.
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

    if (!(profile as { university_id: string } | null)?.university_id) {
      return NextResponse.json({ error: 'No university linked.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') as SupportResourceType | null;

    const resources = await getSupportResources(
      (profile as { university_id: string }).university_id,
      type ?? undefined,
    );

    return NextResponse.json({ success: true, resources });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch resources.';
    console.error('[support/resources] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
