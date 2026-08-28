/**
 * Sliding/fixed-window rate limiter.
 *
 * Uses Upstash Redis (REST API, no extra dependency) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured.
 * Falls back to an in-memory store for local/dev. NOTE: the in-memory store
 * is NOT effective on Vercel's multi-instance deployment — production MUST set
 * the Upstash env vars (spec §4 / audit §5).
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}, 60_000).unref?.();

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

export interface RateLimitOpts {
  windowMs: number; // time window in ms
  max: number; // max requests per window
}

async function redisIncr(key: string, ttlSec: number): Promise<number> {
  // INCR has no built-in TTL option (that's SET ... EX). Pipeline it with an
  // EXPIRE that only takes effect on the first request of the window (NX),
  // so later requests in the same window don't keep pushing the reset back.
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(ttlSec), 'NX'],
    ]),
  });
  const body: any = await res.json();
  if (!Array.isArray(body)) throw new Error(JSON.stringify(body));
  const [incrResult, expireResult] = body;
  if (incrResult?.error) throw new Error(incrResult.error);
  if (expireResult?.error) throw new Error(expireResult.error);
  return Number(incrResult?.result ?? 0);
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Optionally sets X-RateLimit-* headers on the provided response.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOpts,
  response?: { headers: Headers }
): Promise<boolean> {
  const ttlSec = Math.ceil(opts.windowMs / 1000);

  if (useRedis) {
    try {
      const count = await redisIncr(key, ttlSec);
      const remaining = Math.max(0, opts.max - count);
      const resetAt = Math.ceil(Date.now() / 1000) + ttlSec;
      if (response) {
        response.headers.set('X-RateLimit-Remaining', String(remaining));
        response.headers.set('X-RateLimit-Reset', String(resetAt));
      }
      return count <= opts.max;
    } catch (err) {
      console.warn('Redis rate limit failed, falling back to in-memory:', err);
      // fall through to in-memory
    }
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    if (response) {
      response.headers.set('X-RateLimit-Remaining', String(opts.max - 1));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil((now + opts.windowMs) / 1000)));
    }
    return true;
  }

  if (entry.count >= opts.max) {
    if (response) {
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    }
    return false;
  }

  entry.count++;
  if (response) {
    response.headers.set('X-RateLimit-Remaining', String(opts.max - entry.count));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  }
  return true;
}

/**
 * Extract client IP from request headers.
 * Prefers the edge proxy's verified headers (Cloudflare / load balancer) over
 * client-supplied X-Forwarded-For, which is trivially spoofable.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** Validate email format (basic RFC 5322 check). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate logo URL: only http(s), no file://, no internal IPs (SSRF protection). */
export function isValidLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('172.') ||
      host.startsWith('192.168.') ||
      host === '169.254.169.254' ||
      host === '[::1]' ||
      host.startsWith('fc00:') ||
      host.startsWith('fe80:')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
