import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Notes on testing strategy
// --------------------------
// rate-limit.ts reads time via Date.now() directly (NOT injectable) and keeps
// a single module-level `buckets` Map plus a module-level setInterval sweep.
// Neither the Map, the constants, nor the internal consume()/evictIfFull() are
// exported, so we can only drive it through the public wrappers.
//
// To keep tests deterministic and isolated despite the shared module state, we
// import the module fresh inside each test via vi.resetModules() + dynamic
// import(). We also enable fake timers so the module's setInterval (installed at
// import time) is captured and never fires mid-test, and so we can move the
// clock with vi.setSystemTime(). We deliberately do NOT advance/run timers (that
// would trigger the internal sweep); consume() re-reads Date.now() on every call,
// so setSystemTime alone is enough to cross the window boundary.
//
// The in-memory backend (this file's default) is what every test below runs
// against, since UPSTASH_REDIS_REST_URL/TOKEN are unset in the test env --
// exactly like local dev and any deployment without Redis configured. The
// Redis-backed path has its own describe block at the bottom, with
// @upstash/redis mocked (no real network calls, no real account needed).

const WINDOW_MS = 15 * 60 * 1000; // mirror of the module constant (auth window)
const MAX_ATTEMPTS = 5; // mirror of the module constant (auth attempts)
const START = new Date("2026-06-12T00:00:00Z").getTime();

async function loadModule() {
  vi.resetModules();
  return import("./rate-limit");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkAuthRateLimit (in-memory backend)", () => {
  it("allows the first MAX_ATTEMPTS in the window and blocks the next", async () => {
    const { checkAuthRateLimit } = await loadModule();
    const key = "1.2.3.4";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(await checkAuthRateLimit(key)).toBe(true);
    }
    // The (N+1)th attempt within the same window is blocked.
    expect(await checkAuthRateLimit(key)).toBe(false);
    // ...and stays blocked while the window is still open.
    expect(await checkAuthRateLimit(key)).toBe(false);
  });

  it("keys are independent: exhausting one does not block another", async () => {
    const { checkAuthRateLimit } = await loadModule();

    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkAuthRateLimit("key-a");
    expect(await checkAuthRateLimit("key-a")).toBe(false);

    // A different key has its own fresh budget.
    expect(await checkAuthRateLimit("key-b")).toBe(true);
  });

  it("resets the budget once the window expires", async () => {
    const { checkAuthRateLimit } = await loadModule();
    const key = "5.6.7.8";

    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkAuthRateLimit(key);
    expect(await checkAuthRateLimit(key)).toBe(false);

    // Advance the clock to exactly the reset boundary. resetAt was set to
    // START + WINDOW_MS, and the branch fires when resetAt <= now, so the
    // bucket is renewed at the boundary itself.
    vi.setSystemTime(START + WINDOW_MS);
    expect(await checkAuthRateLimit(key)).toBe(true);

    // After the renewal we have a full fresh window again.
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(await checkAuthRateLimit(key)).toBe(true);
    }
    expect(await checkAuthRateLimit(key)).toBe(false);
  });

  it("does not reset one millisecond before the window boundary", async () => {
    const { checkAuthRateLimit } = await loadModule();
    const key = "9.9.9.9";

    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkAuthRateLimit(key);

    // Just shy of the boundary: resetAt > now, so still blocked.
    vi.setSystemTime(START + WINDOW_MS - 1);
    expect(await checkAuthRateLimit(key)).toBe(false);
  });
});

describe("checkChatRateLimit / checkAnswerRateLimit (separate namespaces)", () => {
  it("namespaces chat and answer keys apart from auth and each other", async () => {
    const { checkAuthRateLimit, checkChatRateLimit, checkAnswerRateLimit } =
      await loadModule();

    // Same raw id used across all three; they must not share a bucket because
    // the wrappers prefix the key ("chat:" / "answer:") while auth does not.
    const id = "user-1";
    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkAuthRateLimit(id);
    expect(await checkAuthRateLimit(id)).toBe(false); // auth exhausted (5/window)

    // Chat (30/hr) and answer (200/hr) still have headroom for the same id.
    expect(await checkChatRateLimit(id)).toBe(true);
    expect(await checkAnswerRateLimit(id)).toBe(true);
  });

  it("chat allows 30 per hour then blocks the 31st", async () => {
    const { checkChatRateLimit } = await loadModule();
    const id = "chatter";

    for (let i = 0; i < 30; i++) {
      expect(await checkChatRateLimit(id)).toBe(true);
    }
    expect(await checkChatRateLimit(id)).toBe(false);
  });
});

describe("MAX_BUCKETS eviction path", () => {
  // MAX_BUCKETS is 10000. evictIfFull() runs only on the new-bucket branch:
  // when size >= MAX_BUCKETS it first drops expired entries, then (if still
  // full) evicts the single oldest live entry. We drive both sub-paths.

  it("drops expired entries to make room when the map is full of stale buckets", async () => {
    const { checkAuthRateLimit } = await loadModule();

    // Fill the map to exactly MAX_BUCKETS with distinct keys, all created at
    // START so they share resetAt = START + WINDOW_MS.
    for (let i = 0; i < 10000; i++) await checkAuthRateLimit(`fill-${i}`);

    // Move the clock past the window so every existing bucket is now expired.
    vi.setSystemTime(START + WINDOW_MS + 1);

    // Inserting a brand-new key triggers evictIfFull, which clears all 10000
    // expired entries first. The new insert (and a re-touch of an old key)
    // must succeed as fresh buckets.
    expect(await checkAuthRateLimit("post-expiry-new")).toBe(true);
    expect(await checkAuthRateLimit("fill-0")).toBe(true); // recreated as a fresh bucket
  });

  it("evicts the oldest live entry when the map is full of non-expired buckets", async () => {
    const { checkAuthRateLimit } = await loadModule();

    // "fill-0" is inserted first, so it is the oldest in insertion order and
    // the eviction victim. Give it 2 hits so we can detect a reset later.
    await checkAuthRateLimit("fill-0");
    await checkAuthRateLimit("fill-0");
    for (let i = 1; i < 10000; i++) await checkAuthRateLimit(`fill-${i}`);
    // Map is now full (10000 live, non-expired buckets).

    // Insert a new key WITHOUT advancing the clock: nothing is expired, so the
    // expired-sweep frees nothing and the oldest live entry ("fill-0") is
    // evicted to make room.
    expect(await checkAuthRateLimit("overflow-key")).toBe(true);

    // Proof of eviction: "fill-0" had 2 of 5 used; if it had been retained we
    // could still hit it 3 more times. Instead it now behaves as a brand-new
    // bucket (full fresh budget of MAX_ATTEMPTS), confirming it was dropped and
    // recreated rather than continued.
    let allowed = 0;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (await checkAuthRateLimit("fill-0")) allowed++;
    }
    expect(allowed).toBe(MAX_ATTEMPTS);
  });
});

// vi.mock factories are hoisted above the rest of the file (including any
// outer-scope `const`/`let`), so shared mutable state a mock factory needs
// to close over must go through vi.hoisted() -- a plain module-level
// variable here would throw "not defined" the moment the mock runs.
const redisMockState = vi.hoisted(() => ({
  store: new Map<string, number>(),
  shouldThrow: false,
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn(async (key: string) => {
      if (redisMockState.shouldThrow) throw new Error("simulated Upstash outage");
      const next = (redisMockState.store.get(key) ?? 0) + 1;
      redisMockState.store.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
  })),
}));

describe("Redis backend (UPSTASH_REDIS_REST_URL/TOKEN set)", () => {
  // @upstash/redis is mocked (registered above, module-level) so these
  // tests never touch the network or need a real Upstash account. The mock
  // is a tiny in-memory stand-in for Redis's INCR/EXPIRE semantics, just
  // enough to exercise rate-limit.ts's own logic (the fixed-window counter
  // + fail-open error handling), not to re-test Redis itself.
  beforeEach(() => {
    redisMockState.store.clear();
    redisMockState.shouldThrow = false;
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example-upstash.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the first MAX_ATTEMPTS in the window and blocks the next", async () => {
    const { checkAuthRateLimit } = await loadModule();
    const key = "redis-key";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(await checkAuthRateLimit(key)).toBe(true);
    }
    expect(await checkAuthRateLimit(key)).toBe(false);
  });

  it("keys are independent under the Redis backend too", async () => {
    const { checkAuthRateLimit } = await loadModule();

    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkAuthRateLimit("redis-a");
    expect(await checkAuthRateLimit("redis-a")).toBe(false);
    expect(await checkAuthRateLimit("redis-b")).toBe(true);
  });

  it("fails open (allows the request) when Redis is unreachable", async () => {
    const { checkAuthRateLimit } = await loadModule();
    redisMockState.shouldThrow = true;

    expect(await checkAuthRateLimit("doesnt-matter")).toBe(true);
  });
});
