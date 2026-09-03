/**
 * In-memory sliding-window rate limiter.
 *
 * Sprint 1 scope: a single Node process is assumed. For multi-instance
 * deployments replace this with a Redis/Postgres-backed counter — the call
 * sites only depend on the `checkRateLimit` signature.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/** Drop buckets that have been idle for over an hour. */
function sweep(windowMs: number) {
  const cutoff = Date.now() - windowMs;
  for (const [key, bucket] of buckets) {
    const kept = bucket.timestamps.filter((t) => t > cutoff);
    if (kept.length === 0) {
      buckets.delete(key);
    } else {
      bucket.timestamps = kept;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the oldest hit leaves the window. */
  retryAfterSeconds: number;
}

/**
 * Records a hit against `key` and reports whether it is permitted.
 *
 * @param key      Caller-scoped identity (e.g. `otp:send:<userId>`)
 * @param limit    Maximum hits allowed inside the window
 * @param windowMs Sliding window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (buckets.size > 500) sweep(windowMs);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  const recent = bucket.timestamps.filter((t) => t > cutoff);

  if (recent.length >= limit) {
    const oldest = Math.min(...recent);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    buckets.set(key, { timestamps: recent });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });

  return {
    allowed: true,
    remaining: Math.max(0, limit - recent.length),
    retryAfterSeconds: 0,
  };
}

/** Clears a bucket — used after a successful verification. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
