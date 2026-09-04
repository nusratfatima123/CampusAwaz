import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { studentDecideIdentityRequest } from '@/lib/identity-access';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, approve, notes } = body;

    if (!requestId || typeof approve !== 'boolean') {
      return NextResponse.json(
        { error: 'requestId and approve (boolean) are required.' },
        { status: 400 },
      );
    }

    const result = await studentDecideIdentityRequest(requestId, user.id, approve, notes, request);
    return NextResponse.json({ success: true, request: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not process identity request.';
    console.error('[identity-access/student-decide] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
