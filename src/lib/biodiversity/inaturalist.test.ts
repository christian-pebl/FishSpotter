import { describe, expect, it } from "vitest";
import { isRetryableStatus, nextRetryDelay } from "./inaturalist";

describe("isRetryableStatus", () => {
  it("retries on 429 (rate limit)", () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("retries on 5xx transient errors", () => {
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("does NOT retry on 4xx client errors", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("does NOT retry on 500 (server thinks the request is malformed)", () => {
    // 500 is ambiguous; we treat it as fatal because retrying often just
    // wastes more requests. 502/503/504 are the transient ones.
    expect(isRetryableStatus(500)).toBe(false);
  });
});

describe("nextRetryDelay", () => {
  // Pin RNG so jitter is deterministic in tests.
  const noJitter = () => 0;

  it("uses exponential backoff when no Retry-After header is present", () => {
    expect(nextRetryDelay(0, null, noJitter)).toBe(500);
    expect(nextRetryDelay(1, null, noJitter)).toBe(1000);
    expect(nextRetryDelay(2, null, noJitter)).toBe(2000);
    expect(nextRetryDelay(3, null, noJitter)).toBe(4000);
  });

  it("caps exponential backoff at MAX_DELAY (8s)", () => {
    expect(nextRetryDelay(10, null, noJitter)).toBe(8000);
  });

  it("honours Retry-After header when given as seconds", () => {
    expect(nextRetryDelay(0, "3", noJitter)).toBe(3000);
    expect(nextRetryDelay(0, "10", noJitter)).toBe(8000); // capped at MAX_DELAY
  });

  it("honours Retry-After header when given as HTTP-date", () => {
    // HTTP-date has 1s resolution, so a 4s future round-trips to a delay
    // somewhere in (2000, 4000]. Picking a wide tolerance avoids flakes.
    const future = new Date(Date.now() + 4000).toUTCString();
    const delay = nextRetryDelay(0, future, noJitter);
    expect(delay).toBeGreaterThan(2000);
    expect(delay).toBeLessThanOrEqual(4000);
  });

  it("ignores a malformed Retry-After and falls back to exponential", () => {
    expect(nextRetryDelay(1, "not-a-number", noJitter)).toBe(1000);
  });

  it("ignores a Retry-After in the past and falls back to exponential", () => {
    const past = new Date(Date.now() - 60000).toUTCString();
    expect(nextRetryDelay(0, past, noJitter)).toBe(500);
  });

  it("adds 0-25% jitter on top of exponential", () => {
    // RNG returns 1.0 so we see the maximum jitter (25%).
    expect(nextRetryDelay(0, null, () => 1.0)).toBe(500 + 500 * 0.25);
  });
});
