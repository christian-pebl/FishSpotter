import { afterEach, describe, expect, it } from "vitest";
import { isAuthorisedBearer, isAuthorisedCron } from "./cron-auth";

function reqWithAuth(header?: string): Request {
  const headers = new Headers();
  if (header !== undefined) headers.set("authorization", header);
  return new Request("https://example.test/api/x", { headers });
}

describe("isAuthorisedBearer", () => {
  it("accepts the exact expected bearer token", () => {
    expect(isAuthorisedBearer(reqWithAuth("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    expect(isAuthorisedBearer(reqWithAuth(), "s3cret")).toBe(false);
  });

  it("rejects a mismatched token", () => {
    expect(isAuthorisedBearer(reqWithAuth("Bearer wrong"), "s3cret")).toBe(false);
  });

  it("rejects when no secret is configured, even with a header present", () => {
    expect(isAuthorisedBearer(reqWithAuth("Bearer anything"), undefined)).toBe(false);
  });

  it("rejects a token that differs only in length without throwing", () => {
    expect(isAuthorisedBearer(reqWithAuth("Bearer s3cre"), "s3cret")).toBe(false);
    expect(isAuthorisedBearer(reqWithAuth("Bearer s3crett"), "s3cret")).toBe(false);
  });

  it("is case-sensitive on the token value", () => {
    expect(isAuthorisedBearer(reqWithAuth("Bearer S3CRET"), "s3cret")).toBe(false);
  });
});

describe("isAuthorisedCron", () => {
  const ORIGINAL = process.env.CRON_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it("reads CRON_SECRET from the environment", () => {
    process.env.CRON_SECRET = "cron-secret-value";
    expect(isAuthorisedCron(reqWithAuth("Bearer cron-secret-value"))).toBe(true);
    expect(isAuthorisedCron(reqWithAuth("Bearer wrong"))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorisedCron(reqWithAuth("Bearer anything"))).toBe(false);
  });
});
