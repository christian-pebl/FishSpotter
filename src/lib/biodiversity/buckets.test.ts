import { describe, expect, it } from "vitest";
import { bucketFor, monthsAround, DEPTH_BUCKET_NULL } from "./buckets";

describe("bucketFor", () => {
  const base = {
    lat: 50.37,
    lon: -4.14,
    depthM: 23,
    recordingDatetime: "2024-06-15T12:00:00Z",
  };

  it("rounds lat/lon to 0.1 degrees", () => {
    const b = bucketFor(base)!;
    expect(b.latBucket).toBe(50.4);
    expect(b.lonBucket).toBe(-4.1);
  });

  it("floors depth to the nearest 10m band", () => {
    expect(bucketFor({ ...base, depthM: 23 })!.depthBucket).toBe(20);
    expect(bucketFor({ ...base, depthM: 0 })!.depthBucket).toBe(0);
    expect(bucketFor({ ...base, depthM: 99 })!.depthBucket).toBe(90);
  });

  it("uses the null-depth sentinel when depth is missing", () => {
    expect(bucketFor({ ...base, depthM: null })!.depthBucket).toBe(DEPTH_BUCKET_NULL);
    expect(bucketFor({ ...base, depthM: undefined })!.depthBucket).toBe(DEPTH_BUCKET_NULL);
  });

  it("extracts the 1-indexed UTC month", () => {
    expect(bucketFor({ ...base, recordingDatetime: "2024-01-31T23:00:00Z" })!.month).toBe(1);
    expect(bucketFor({ ...base, recordingDatetime: "2024-12-01T00:00:00Z" })!.month).toBe(12);
  });

  it("uses UTC, not local time, for the month boundary", () => {
    // 23:30 UTC on 30 June is still June in UTC regardless of the runner's TZ.
    expect(bucketFor({ ...base, recordingDatetime: "2024-06-30T23:30:00Z" })!.month).toBe(6);
  });

  it("returns null when lat is missing", () => {
    expect(bucketFor({ ...base, lat: null })).toBeNull();
    expect(bucketFor({ ...base, lat: undefined })).toBeNull();
  });

  it("returns null when lon is missing", () => {
    expect(bucketFor({ ...base, lon: null })).toBeNull();
  });

  it("returns null when the datetime is missing or empty", () => {
    expect(bucketFor({ ...base, recordingDatetime: null })).toBeNull();
    expect(bucketFor({ ...base, recordingDatetime: "" })).toBeNull();
  });

  it("returns null when the datetime is unparseable", () => {
    expect(bucketFor({ ...base, recordingDatetime: "not-a-date" })).toBeNull();
  });

  it("treats lat/lon of 0 as valid (not falsy-null)", () => {
    const b = bucketFor({ ...base, lat: 0, lon: 0 })!;
    expect(b).not.toBeNull();
    expect(b.latBucket).toBe(0);
    expect(b.lonBucket).toBe(0);
  });
});

describe("monthsAround", () => {
  it("returns the previous, current, and next month", () => {
    expect(monthsAround(6)).toEqual([5, 6, 7]);
  });

  it("wraps around at January (prev = December)", () => {
    expect(monthsAround(1)).toEqual([12, 1, 2]);
  });

  it("wraps around at December (next = January)", () => {
    expect(monthsAround(12)).toEqual([11, 12, 1]);
  });
});
