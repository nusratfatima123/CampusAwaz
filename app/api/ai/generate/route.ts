import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateComplaintDraft } from '@/lib/ai';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  validateAiInput,
  validatePriority,
  validatePrivacyMode,
} from '@/lib/validators';
import {
  AI_GENERATE_RATE_LIMIT,
  AI_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';
import type { PrivacyMode } from '@/types/database';

/**
 * POST /api/ai/generate
 *
 * Turns the student's free text into a structured draft. The draft is returned
 * for editing only — it is never written to a complaint here.
 */
export async function POST(request: Request) {
  let userId: string;
  let profileName: string | null = null;
  let userEmail: string | null = null;

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
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    userId = user.id;
    userEmail = user.email ?? null;
    profileName = profile.full_name ?? null;
  } catch (err) {
    console.error(
      '[ai/generate] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }

  // --- Rate limit: 20 requests / minute / user ------------------------------
  const limit = checkRateLimit(
    `ai:generate:${userId}`,
    AI_GENERATE_RATE_LIMIT,
    AI_RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many draft requests. Try again in ${limit.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: {
    description?: unknown;
    categoryKey?: unknown;
    priority?: unknown;
    privacyMode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description : '';
  const categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey : 'other';
  const priority = typeof body.priority === 'string' ? body.priority : 'medium';
  const privacyMode =
    typeof body.privacyMode === 'string' ? body.privacyMode : 'identified';

  const inputCheck = validateAiInput(description);
  if (!inputCheck.valid) {
    return NextResponse.json({ error: inputCheck.error }, { status: 400 });
  }

  const priorityCheck = validatePriority(priority);
  if (!priorityCheck.valid) {
    return NextResponse.json({ error: priorityCheck.error }, { status: 400 });
  }

  const privacyCheck = validatePrivacyMode(privacyMode);
  if (!privacyCheck.valid) {
    return NextResponse.json({ error: privacyCheck.error }, { status: 400 });
  }

  const names = [profileName, userEmail?.split('@')[0] ?? null].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  const { draft, meta } = await generateComplaintDraft(
    description,
    categoryKey,
    priority,
    { privacyMode: privacyMode as PrivacyMode, names }
  );

  await audit(AUDIT_EVENTS.AI_DRAFT_GENERATED, {
    userId,
    actor: 'user',
    metadata: {
      category_key: categoryKey,
      priority,
      privacy_mode: privacyMode,
      identity_stripped:
        privacyMode === 'anonymous' || privacyMode === 'confidential',
      model_used: meta.model_used,
      degraded: meta.degraded,
      sensitive: meta.sensitive,
      title_length: draft.title.length,
      description_length: draft.description.length,
    },
    request,
  });

  return NextResponse.json({
    success: true,
    model_used: meta.model_used,
    degraded: meta.degraded,
    sensitive: meta.sensitive,
    draft: {
      title: draft.title,
      description: draft.description,
      who: draft.who ?? null,
      what: draft.what,
      when: draft.when ?? null,
      where: draft.where ?? null,
      impact: draft.impact,
      requested_action: draft.requested_action,
    },
  });
}
