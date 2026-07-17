import { Redis } from "@upstash/redis";

// Shared-store backend (2026-07-16 audit finding 3.2/6). The in-memory Map
// below is per-lambda-instance on Vercel: every warm serverless instance
// keeps its own counters, so the EFFECTIVE limit loosens by however many
// instances are warm at once. When UPSTASH_REDIS_REST_URL/TOKEN are set,
// every check is backed by a single shared Redis counter instead, so the
// limit means what it says regardless of how many instances are running.
// Unset (the default -- no Upstash account exists yet), this falls back to
// the original in-memory behaviour with zero change: local dev and any
// deployment without Redis configured work exactly as before.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Bound the map so an attacker spinning unique keys can't exhaust memory.
// On overflow, drop all expired entries first, then evict the oldest live
// entry (Map iteration is insertion-ordered). Only relevant to the
// in-memory fallback -- Redis keys expire on their own via TTL.
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

function consumeInMemory(key: string, windowMs: number, maxAttempts: number): boolean {
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

// Fixed-window counter via INCR + a one-time EXPIRE. INCR is atomic and
// creates the key at 1 if absent; only the caller that observes count===1
// (i.e. the one that just created it) sets the TTL, so concurrent callers
// racing the same new key can't stomp each other's expiry. The tiny window
// where a key could theoretically outlive its TTL (INCR succeeds, the
// process dies before the EXPIRE call) just means that one bucket runs one
// window long -- a benign, standard trade-off for this pattern, not a
// security hole.
async function consumeRedis(
  key: string,
  windowMs: number,
  maxAttempts: number,
): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  try {
    const count = await redis!.incr(redisKey);
    if (count === 1) {
      await redis!.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    return count <= maxAttempts;
  } catch (err) {
    // Fail OPEN: a rate limiter's job is abuse resistance, not core auth.
    // If Upstash is unreachable, blocking every legitimate request would be
    // a worse outcome than under-enforcing a limit until it recovers.
    // eslint-disable-next-line no-console
    console.error("[rate-limit] Redis backend unavailable, allowing request", err);
    return true;
  }
}

async function consume(key: string, windowMs: number, maxAttempts: number): Promise<boolean> {
  if (redis) return consumeRedis(key, windowMs, maxAttempts);
  return consumeInMemory(key, windowMs, maxAttempts);
}

export async function checkAuthRateLimit(key: string): Promise<boolean> {
  return consume(key, WINDOW_MS, MAX_ATTEMPTS);
}

const CHAT_WINDOW_MS = 60 * 60 * 1000;
const CHAT_MAX_PER_HOUR = 30;

export async function checkChatRateLimit(userId: string): Promise<boolean> {
  return consume(`chat:${userId}`, CHAT_WINDOW_MS, CHAT_MAX_PER_HOUR);
}

// S6-T6: anti-cheat rate-limit on answer submission. Caps a single
// user at 200 submissions per hour — generous for legitimate spotting
// (one per ~18s) but tight enough to flag bots that rip the feed.
const ANSWER_WINDOW_MS = 60 * 60 * 1000;
const ANSWER_MAX_PER_HOUR = 200;

export async function checkAnswerRateLimit(userId: string): Promise<boolean> {
  return consume(`answer:${userId}`, ANSWER_WINDOW_MS, ANSWER_MAX_PER_HOUR);
}

// Engagement-event ingest (POST /api/events). Beacons are batched, so this caps
// the number of REQUESTS per key/hour — 600 (~one flush every 6s) is far above
// real usage but stops a loose client or bot from flooding the Event table.
const EVENT_WINDOW_MS = 60 * 60 * 1000;
const EVENT_MAX_PER_HOUR = 600;

export async function checkEventRateLimit(key: string): Promise<boolean> {
  return consume(`event:${key}`, EVENT_WINDOW_MS, EVENT_MAX_PER_HOUR);
}

// web-vitals sink (POST /api/vitals). Keyed on client IP since the route is
// unauthenticated. A page load fires a handful of beacons; 120/hour/IP is
// generous for multi-tab browsing but stops a browser-originated flood from
// bloating the Vital table. (The same-origin gate is the primary defense; this
// is the secondary cap for floods that do carry a first-party Origin.)
const VITALS_WINDOW_MS = 60 * 60 * 1000;
const VITALS_MAX_PER_HOUR = 120;

export async function checkVitalsRateLimit(ipKey: string): Promise<boolean> {
  return consume(`vitals:${ipKey}`, VITALS_WINDOW_MS, VITALS_MAX_PER_HOUR);
}

// Signed-out reveal preview (POST /api/answers/preview). Read-only + same-origin
// gated, but runs a DB read per call, so cap per IP. 200/hour matches the authed
// answer cap — well above a real guest's identify cadence.
const PREVIEW_WINDOW_MS = 60 * 60 * 1000;
const PREVIEW_MAX_PER_HOUR = 200;

export async function checkPreviewRateLimit(ipKey: string): Promise<boolean> {
  return consume(`preview:${ipKey}`, PREVIEW_WINDOW_MS, PREVIEW_MAX_PER_HOUR);
}

// Only needed for the in-memory fallback -- Redis keys expire on their own.
if (!redis && typeof globalThis !== "undefined") {
  const sweep = () => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  };
  setInterval(sweep, WINDOW_MS).unref?.();
}
