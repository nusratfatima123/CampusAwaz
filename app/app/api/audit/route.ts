import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/audit';

/**
 * Internal audit-log endpoint.
 *
 * Only writes events for the *currently authenticated* user — a client can
 * never forge a log entry for somebody else. The allow-list keeps this from
 * becoming a general-purpose log injection surface.
 */

const ALLOWED_EVENTS = new Set([
  'user.registered',
  'user.login',
  'user.logout',
  'verification.university.selected',
  'verification.status.selected',
]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { event, metadata } = body as {
    event?: unknown;
    metadata?: unknown;
  };

  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 });
  }

  // Resolve the actor from the session — never from the request body.
  let userId: string | undefined;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  } catch {
    userId = undefined;
  }

  // `user.registered` is fired right after sign-up, when email confirmation may
  // mean there is no session yet. Every other event requires one.
  if (!userId && event !== 'user.registered') {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const safeMetadata =
    typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : undefined;

  await audit(event, {
    userId,
    actor: 'user',
    metadata: safeMetadata,
    request,
  });

  return NextResponse.json({ success: true });
}
