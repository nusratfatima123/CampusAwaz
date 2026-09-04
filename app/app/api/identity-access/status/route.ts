import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccessIdentity } from '@/lib/identity-access';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const complaintId = searchParams.get('complaintId');

    if (!complaintId) {
      return NextResponse.json({ error: 'complaintId is required.' }, { status: 400 });
    }

    const hasAccess = await canAccessIdentity(complaintId, user.id);
    return NextResponse.json({ canAccess: hasAccess });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not check identity access.';
    console.error('[identity-access/status] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
