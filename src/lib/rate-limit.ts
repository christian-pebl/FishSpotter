const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkAuthRateLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (b.count >= MAX_ATTEMPTS) return false;
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
