/**
 * OCR adapter for student-card verification.
 *
 * Providers:
 *   - `mock`   (default) — deterministic demo data, no network calls.
 *   - `gemini`           — Google Gemini vision with structured JSON output.
 *   - `azure`            — not wired in Sprint 1; falls back to manual review.
 *
 * Confidence *threshold* logic deliberately lives in the API route, not here:
 * this adapter only reports what it saw.
 */

export interface OcrResult {
  name?: string;
  roll_id?: string;
  university?: string;
  /** ISO date when parseable, otherwise the raw printed text. */
  validity?: string;
  /** 0..1 */
  confidence: number;
  needs_manual_review: boolean;
  raw?: unknown;
}

export type OcrProvider = 'mock' | 'gemini' | 'azure';

export function getOcrProvider(): OcrProvider {
  const raw = (process.env.OCR_PROVIDER ?? 'mock').trim().toLowerCase();
  if (raw === 'gemini' || raw === 'azure') return raw;
  return 'mock';
}

export interface ExtractOptions {
  /** Original filename — used by the mock provider to simulate low confidence. */
  filename?: string;
}

/**
 * Extracts structured fields from a student card image/PDF.
 * Never throws: provider failures degrade to `needs_manual_review = true`.
 */
export async function extractStudentCard(
  buffer: Buffer,
  mime: string,
  options: ExtractOptions = {}
): Promise<OcrResult> {
  const provider = getOcrProvider();

  try {
    switch (provider) {
      case 'gemini':
        return await extractWithGemini(buffer, mime);
      case 'azure':
        return manualReviewFallback(
          'The Azure OCR provider is not configured in this build.'
        );
      case 'mock':
      default:
        return extractWithMock(buffer, mime, options);
    }
  } catch (err) {
    console.error(
      '[ocr] extraction failed, falling back to manual review:',
      err instanceof Error ? err.message : err
    );
    return manualReviewFallback(
      err instanceof Error ? err.message : 'Unknown OCR failure.'
    );
  }
}

function manualReviewFallback(reason: string): OcrResult {
  return {
    confidence: 0,
    needs_manual_review: true,
    raw: { error: reason },
  };
}

// ---------------------------------------------------------------------------
// mock provider
// ---------------------------------------------------------------------------

const MOCK_NAMES = [
  'Ayesha Khan',
  'Bilal Ahmed',
  'Fatima Noor',
  'Hassan Raza',
  'Zainab Iqbal',
];

const MOCK_UNIVERSITIES = [
  'Lahore University of Management Sciences',
  'National University of Sciences and Technology',
  'FAST National University of Computer and Emerging Sciences',
];

/** Cheap deterministic hash so repeated uploads of one file give one result. */
function stableSeed(buffer: Buffer, filename: string): number {
  let hash = 2166136261;
  const sample = `${filename}:${buffer.length}`;
  for (let i = 0; i < sample.length; i += 1) {
    hash ^= sample.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Mix in a few bytes of content for extra stability across same-named files.
  for (let i = 0; i < Math.min(buffer.length, 64); i += 8) {
    hash ^= buffer[i] ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function extractWithMock(
  buffer: Buffer,
  mime: string,
  options: ExtractOptions
): OcrResult {
  const filename = (options.filename ?? '').toLowerCase();
  const seed = stableSeed(buffer, filename);

  // Filename escape hatch for QA: `...lowconf...` simulates a poor scan.
  const lowConfidence = filename.includes('lowconf');

  const name = MOCK_NAMES[seed % MOCK_NAMES.length] ?? MOCK_NAMES[0];
  const university =
    MOCK_UNIVERSITIES[seed % MOCK_UNIVERSITIES.length] ?? MOCK_UNIVERSITIES[0];

  const year = 2000 + (seed % 5) + 21; // 2021..2025
  const rollId = `${String(year).slice(-2)}L-${1000 + (seed % 8999)}`;
  const validity = `${year + 4}-06-30`;

  if (lowConfidence) {
    return {
      name,
      roll_id: rollId,
      university: undefined,
      validity: undefined,
      confidence: 0.41,
      needs_manual_review: true,
      raw: {
        provider: 'mock',
        mode: 'low_confidence',
        mime,
        note: 'Simulated blurry scan — several fields unreadable.',
      },
    };
  }

  return {
    name,
    roll_id: rollId,
    university,
    validity,
    confidence: 0.92,
    needs_manual_review: false,
    raw: { provider: 'mock', mode: 'standard', mime },
  };
}

// ---------------------------------------------------------------------------
// gemini provider
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-1.5-flash';

const GEMINI_PROMPT = `You are verifying a university student identification card.
Extract the printed fields and return ONLY JSON matching this schema:
{
  "name": string | null,
  "roll_id": string | null,
  "university": string | null,
  "validity": string | null,
  "confidence": number
}
"validity" is the expiry or valid-until date (ISO YYYY-MM-DD when possible, else the raw text).
"confidence" is your overall confidence from 0 to 1 that this is a genuine, legible student card and the fields are correct.
Use null for any field you cannot read. Do not invent values.`;

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
}

async function extractWithGemini(buffer: Buffer, mime: string): Promise<OcrResult> {
  const apiKey = process.env.OCR_API_KEY;
  if (!apiKey) {
    return manualReviewFallback('OCR_PROVIDER=gemini but OCR_API_KEY is not set.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let payload: GeminiResponse;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: GEMINI_PROMPT },
              { inline_data: { mime_type: mime, data: buffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return manualReviewFallback(
        `Gemini responded ${response.status}: ${body.slice(0, 200)}`
      );
    }

    payload = (await response.json()) as GeminiResponse;
  } finally {
    clearTimeout(timeout);
  }

  if (payload.error?.message) {
    return manualReviewFallback(`Gemini error: ${payload.error.message}`);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    return manualReviewFallback('Gemini returned an empty response.');
  }

  return parseGeminiJson(text, payload);
}

/** Adapter boundary: the model returns untyped JSON, so `unknown` is narrowed here. */
function parseGeminiJson(text: string, raw: unknown): OcrResult {
  let parsed: unknown;
  try {
    // Strip markdown fences if the model added them despite the JSON mime type.
    const cleaned = text
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return manualReviewFallback('Gemini returned malformed JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return manualReviewFallback('Gemini returned an unexpected shape.');
  }

  const obj = parsed as Record<string, unknown>;

  const asText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed && trimmed.toLowerCase() !== 'null' ? trimmed : undefined;
  };

  const rawConfidence = obj.confidence;
  let confidence = typeof rawConfidence === 'number' ? rawConfidence : Number.NaN;
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(Math.max(confidence, 0), 1);

  return {
    name: asText(obj.name),
    roll_id: asText(obj.roll_id),
    university: asText(obj.university),
    validity: asText(obj.validity),
    confidence,
    needs_manual_review: confidence === 0,
    raw,
  };
}
