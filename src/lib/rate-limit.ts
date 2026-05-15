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

export function checkAuthRateLimit(key: string): boolean {
  return consume(key, WINDOW_MS, MAX_ATTEMPTS);
}

const CHAT_WINDOW_MS = 60 * 60 * 1000;
const CHAT_MAX_PER_HOUR = 30;

export function checkChatRateLimit(userId: string): boolean {
  return consume(`chat:${userId}`, CHAT_WINDOW_MS, CHAT_MAX_PER_HOUR);
}

if (typeof globalThis !== "undefined") {
  const sweep = () => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  };
  setInterval(sweep, WINDOW_MS).unref?.();
}
