/**
 * Rate limiting (security/robustness audit, 22 Jun 2026).
 *
 * Two backends behind one async API:
 *
 *  - **Upstash Redis (distributed)** — used whenever UPSTASH_REDIS_REST_URL +
 *    UPSTASH_REDIS_REST_TOKEN are set. This is the production path. Vercel runs
 *    each route as N independent serverless instances, so the previous purely
 *    in-memory limiter only ever saw a fraction of a key's traffic — an
 *    attacker (or a bot farming the leaderboard) spread across instances could
 *    sail past every cap. A shared Redis store makes the limit global.
 *
 *  - **In-memory (fallback)** — used in local dev, tests, and any deploy
 *    without Upstash creds. Single-process only; correct for one instance,
 *    best-effort across many. Bounded so unique-key spam can't exhaust memory.
 *
 * All exported checks are async (the Upstash call is a network round-trip).
 * They are only ever awaited from async request handlers, so this is safe.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Bound the map so an attacker spinning unique keys can't exhaust memory.
// On overflow, drop all expired entries first, then evict the oldest live
// entry (Map iteration is insertion-ordered).
const MAX_BUCKETS = 10000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function evictIfFull() {
  if (buckets.size < MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  if (buckets.size < MAX_BUCKETS) return;
  const oldest = buckets.keys().next().value;
  if (oldest !== undefined) buckets.delete(oldest);
}

function consume(key: string, windowMs: number, maxAttempts: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    evictIfFull();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (b.count >= maxAttempts) return false;
  b.count += 1;
  return true;
}

if (typeof globalThis !== "undefined") {
  const sweep = () => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  };
  setInterval(sweep, WINDOW_MS).unref?.();
}

// ---------------------------------------------------------------------------
// Distributed (Upstash) backend
// ---------------------------------------------------------------------------
const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

export function isDistributedRateLimit(): boolean {
  return redis !== null;
}

/** Build a sliding-window limiter, or null when Upstash isn't configured. */
function makeLimiter(limit: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${prefix}`,
    analytics: false,
  });
}

// If Upstash is briefly unreachable we FAIL OPEN (allow the request) rather
// than locking every user out — the in-memory fallback still provides a
// per-instance backstop, and these limits guard abuse, not correctness.
async function check(
  limiter: Ratelimit | null,
  upstashKey: string,
  fallbackKey: string,
  windowMs: number,
  maxAttempts: number,
): Promise<boolean> {
  if (limiter) {
    try {
      const { success } = await limiter.limit(upstashKey);
      return success;
    } catch {
      return consume(fallbackKey, windowMs, maxAttempts);
    }
  }
  return consume(fallbackKey, windowMs, maxAttempts);
}

// ---------------------------------------------------------------------------
// Public checks
// ---------------------------------------------------------------------------
const authLimiter = makeLimiter(MAX_ATTEMPTS, "15 m", "auth");

export function checkAuthRateLimit(key: string): Promise<boolean> {
  return check(authLimiter, key, key, WINDOW_MS, MAX_ATTEMPTS);
}

const CHAT_WINDOW_MS = 60 * 60 * 1000;
const CHAT_MAX_PER_HOUR = 30;
const chatLimiter = makeLimiter(CHAT_MAX_PER_HOUR, "1 h", "chat");

export function checkChatRateLimit(userId: string): Promise<boolean> {
  return check(chatLimiter, userId, `chat:${userId}`, CHAT_WINDOW_MS, CHAT_MAX_PER_HOUR);
}

// S6-T6: anti-cheat rate-limit on answer submission. Caps a single
// user at 200 submissions per hour — generous for legitimate spotting
// (one per ~18s) but tight enough to flag bots that rip the feed.
const ANSWER_WINDOW_MS = 60 * 60 * 1000;
const ANSWER_MAX_PER_HOUR = 200;
const answerLimiter = makeLimiter(ANSWER_MAX_PER_HOUR, "1 h", "answer");

export function checkAnswerRateLimit(userId: string): Promise<boolean> {
  return check(answerLimiter, userId, `answer:${userId}`, ANSWER_WINDOW_MS, ANSWER_MAX_PER_HOUR);
}

// Engagement-event ingest (POST /api/events). Beacons are batched, so this caps
// the number of REQUESTS per key/hour — 600 (~one flush every 6s) is far above
// real usage but stops a loose client or bot from flooding the Event table.
const EVENT_WINDOW_MS = 60 * 60 * 1000;
const EVENT_MAX_PER_HOUR = 600;
const eventLimiter = makeLimiter(EVENT_MAX_PER_HOUR, "1 h", "event");

export function checkEventRateLimit(key: string): Promise<boolean> {
  return check(eventLimiter, key, `event:${key}`, EVENT_WINDOW_MS, EVENT_MAX_PER_HOUR);
}
