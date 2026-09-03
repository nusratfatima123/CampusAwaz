import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeComplaint, prepareAiInput } from '@/lib/ai';
import {
  createAiSession,
  getCategoryByKeyForRouting,
  persistRecommendation,
  resolveDepartment,
} from '@/lib/routing';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateAiInput, validatePrivacyMode } from '@/lib/validators';
import {
  AI_ANALYZE_RATE_LIMIT,
  AI_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';
import type { PrivacyMode } from '@/types/database';

/**
 * POST /api/ai/analyze
 *
 * Classifies a free-text complaint and returns a *recommendation only*. Nothing
 * is applied to a complaint here — the student reviews and approves the values,
 * and the create endpoint links the approved recommendation.
 *
 * Anonymous and confidential inputs are identity-stripped before the text
 * reaches any provider, and before it is stored in `ai_sessions`.
 */
export async function POST(request: Request) {
  let userId: string;
  let profileName: string | null = null;
  let profileUniversityId: string | null = null;
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
      .select('id, full_name, university_id, affiliation_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.affiliation_status !== 'verified') {
      return NextResponse.json(
        { error: 'Verify your university affiliation before using the assistant.' },
        { status: 403 }
      );
    }

    userId = user.id;
    userEmail = user.email ?? null;
    profileName = profile.full_name ?? null;
    profileUniversityId = profile.university_id ?? null;
  } catch (err) {
    console.error(
      '[ai/analyze] Supabase is not configured:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: 'Server is not configured. Add your Supabase keys to .env.local.' },
      { status: 503 }
    );
  }

  // --- Rate limit: 30 requests / minute / user ------------------------------
  const limit = checkRateLimit(
    `ai:analyze:${userId}`,
    AI_ANALYZE_RATE_LIMIT,
    AI_RATE_LIMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many analysis requests. Try again in ${limit.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  // --- Body ----------------------------------------------------------------
  let body: {
    description?: unknown;
    privacyMode?: unknown;
    universityId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description : '';
  const privacyMode =
    typeof body.privacyMode === 'string' ? body.privacyMode : 'identified';

  const inputCheck = validateAiInput(description);
  if (!inputCheck.valid) {
    return NextResponse.json({ error: inputCheck.error }, { status: 400 });
  }

  const privacyCheck = validatePrivacyMode(privacyMode);
  if (!privacyCheck.valid) {
    return NextResponse.json({ error: privacyCheck.error }, { status: 400 });
  }

  // The caller may pass a universityId, but the profile is authoritative — a
  // student can never analyse against another university's routing table.
  const universityId = profileUniversityId;
  if (!universityId) {
    return NextResponse.json(
      { error: 'Select your university before using the assistant.' },
      { status: 400 }
    );
  }

  // --- Identity stripping BEFORE storage and BEFORE the provider call -------
  const names = [profileName, userEmail?.split('@')[0] ?? null].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  const safeInput = prepareAiInput(description, {
    privacyMode,
    names,
  });

  const identityStripped =
    privacyMode === 'anonymous' || privacyMode === 'confidential';

  // --- Session + provider call --------------------------------------------
  const sessionId = await createAiSession({
    userId,
    sessionType: 'complaint_assist',
    rawInput: safeInput,
    privacyMode: privacyMode as PrivacyMode,
  });

  const { analysis, meta } = await analyzeComplaint(description, {
    privacyMode: privacyMode as PrivacyMode,
    names,
  });

  // --- Map provider keys onto real rows -----------------------------------
  const [category, department] = await Promise.all([
    getCategoryByKeyForRouting(analysis.category_key),
    resolveDepartment(universityId, analysis.department_key, analysis.category_key),
  ]);

  const recommendation = await persistRecommendation({
    sessionId,
    analysis,
    category,
    department,
    modelUsed: meta.model_used,
  });

  await audit(AUDIT_EVENTS.AI_ANALYSIS_REQUESTED, {
    userId,
    actor: 'user',
    metadata: {
      session_id: sessionId,
      recommendation_id: recommendation?.id ?? null,
      privacy_mode: privacyMode,
      identity_stripped: identityStripped,
      category_key: analysis.category_key,
      priority: analysis.priority,
      department_key: department?.key ?? analysis.department_key,
      overall_confidence: analysis.overall_confidence,
      model_used: meta.model_used,
      degraded: meta.degraded,
      sensitive: meta.sensitive,
      input_length: safeInput.length,
    },
    request,
  });

  return NextResponse.json({
    success: true,
    session_id: sessionId,
    recommendation_id: recommendation?.id ?? null,
    identity_stripped: identityStripped,
    model_used: meta.model_used,
    degraded: meta.degraded,
    sensitive: meta.sensitive,
    recommendation: {
      category_key: analysis.category_key,
      category_id: category?.id ?? null,
      category_label: category?.label ?? analysis.category_key,
      category_is_sensitive: Boolean(category?.is_sensitive),
      subcategory: analysis.subcategory ?? null,
      priority: analysis.priority,
      department_key: department?.key ?? analysis.department_key,
      department_id: department?.id ?? null,
      department_name: department?.name ?? analysis.department_key,
      confidence: {
        category: analysis.category_confidence,
        priority: analysis.priority_confidence,
        department: analysis.department_confidence,
        overall: analysis.overall_confidence,
      },
    },
  });
}
