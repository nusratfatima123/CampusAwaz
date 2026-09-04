import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthorityRequest } from '@/lib/authority';

/**
 * GET /api/authority/request/[id]
 * Get a single authority request by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const req = await getAuthorityRequest(id);
    if (!req) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (req.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    return NextResponse.json({ request: req });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch request.';
    console.error('[authority/request/[id]] GET failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
