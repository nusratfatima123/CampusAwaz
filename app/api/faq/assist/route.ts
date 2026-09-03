import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { groundFaqAnswer } from '@/lib/faq';
import { audit, AUDIT_EVENTS } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  FAQ_RATE_LIMIT,
  FAQ_INPUT_MIN,
  FAQ_INPUT_MAX,
  AI_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';

/**
 * POST /api/faq/assist
 *
 * Returns a grounded FAQ answer using only approved university content.
 * Rate-limited per user. Never generates open-domain claims.
 */
export async function POST(request: Request) {
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

    const limit = checkRateLimit(
      `faq:assist:${user.id}`,
      FAQ_RATE_LIMIT,
      AI_RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'A query string is required.' },
        { status: 400 },
      );
    }

    const trimmed = query.trim();
    if (trimmed.length < FAQ_INPUT_MIN) {
      return NextResponse.json(
        { error: `Query must be at least ${FAQ_INPUT_MIN} characters.` },
        { status: 400 },
      );
    }
    if (trimmed.length > FAQ_INPUT_MAX) {
      return NextResponse.json(
        { error: `Query must be at most ${FAQ_INPUT_MAX} characters.` },
        { status: 400 },
      );
    }

    const result = await groundFaqAnswer(profile.university_id, trimmed);

    await audit(AUDIT_EVENTS.FAQ_ASSIST_REQUESTED, {
      userId: user.id,
      actor: 'user',
      metadata: {
        query_length: trimmed.length,
        sources_count: result.sources.length,
        confidence: result.confidence,
        model_used: result.modelUsed,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
      model_used: result.modelUsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate answer.';
    console.error('[faq/assist] failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
