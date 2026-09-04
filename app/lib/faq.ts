import { createAdminClient } from './supabase/admin';
import { FAQ_INPUT_MIN, FAQ_INPUT_MAX } from './constants';
import type { FaqEntry, Policy } from '@/types/database';

/**
 * Server-side FAQ and policy helpers.
 *
 * SERVER ONLY — uses the service-role client.
 */

// ---------------------------------------------------------------------------
// FAQ Entries
// ---------------------------------------------------------------------------

export async function getFaqEntries(
  universityId: string,
  categoryKey?: string,
): Promise<FaqEntry[]> {
  const admin = createAdminClient();

  let query = admin
    .from('faq_entries')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (categoryKey) {
    query = query.eq('category_key', categoryKey);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FaqEntry[];
}

export async function searchFaqEntries(
  universityId: string,
  query: string,
): Promise<FaqEntry[]> {
  const admin = createAdminClient();

  const trimmed = query.trim();
  if (trimmed.length < FAQ_INPUT_MIN) {
    throw new Error(`Query must be at least ${FAQ_INPUT_MIN} characters.`);
  }
  if (trimmed.length > FAQ_INPUT_MAX) {
    throw new Error(`Query must be at most ${FAQ_INPUT_MAX} characters.`);
  }

  const words = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  if (words.length === 0) {
    throw new Error('Query must contain meaningful words.');
  }

  const { data, error } = await admin
    .from('faq_entries')
    .select('*')
    .eq('is_active', true)
    .or(
      words.map((w) => `question.ilike.%${w}%,answer.ilike.%${w}%`).join(','),
    )
    .order('display_order', { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);
  return (data ?? []) as FaqEntry[];
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function getPolicies(
  universityId: string,
  categoryKey?: string,
): Promise<Policy[]> {
  const admin = createAdminClient();

  let query = admin
    .from('policies')
    .select('*')
    .eq('is_active', true)
    .order('effective_date', { ascending: false });

  if (categoryKey) {
    query = query.eq('category_key', categoryKey);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Policy[];
}

// ---------------------------------------------------------------------------
// Grounded FAQ Answer (mock provider)
// ---------------------------------------------------------------------------

export interface FaqAssistResult {
  answer: string;
  sources: { question: string; answer: string; id: string }[];
  confidence: number;
  modelUsed: string;
}

/**
 * Generates a grounded answer using only approved FAQ content.
 * Falls back to "no matching information" when no FAQ entries match.
 * Never generates open-domain claims.
 */
export async function groundFaqAnswer(
  universityId: string,
  query: string,
): Promise<FaqAssistResult> {
  const matches = await searchFaqEntries(universityId, query);

  if (matches.length === 0) {
    return {
      answer:
        "I couldn't find an answer in the university's approved resources. Please contact the support office or try rephrasing your question.",
      sources: [],
      confidence: 0,
      modelUsed: 'faq-grounded-mock',
    };
  }

  const topMatches = matches.slice(0, 3);
  const sources = topMatches.map((m) => ({
    question: m.question,
    answer: m.answer,
    id: m.id,
  }));

  const answerParts = topMatches.map(
    (m) => `**${m.question}**\n${m.answer}`,
  );

  const confidence = Math.min(0.95, 0.5 + matches.length * 0.15);

  return {
    answer: answerParts.join('\n\n---\n\n'),
    sources,
    confidence,
    modelUsed: 'faq-grounded-mock',
  };
}
