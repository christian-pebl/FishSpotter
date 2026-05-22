import { describe, expect, it } from "vitest";
import { doctor, staticChecks, __test__ } from "../doctor";
import type { BootstrapTokens } from "../config";

function emptyTokens(overrides: Partial<BootstrapTokens> = {}): BootstrapTokens {
  return {
    r2BucketName: "fishspotter-snippets",
    publicSiteUrl: "https://fish-spotter.vercel.app",
    ...overrides,
  } as BootstrapTokens;
}

describe("staticChecks", () => {
  it("flags every missing token field", () => {
    const checks = staticChecks({ tokens: emptyTokens() });
    expect(checks.filter((c) => c.status === "missing").length).toBeGreaterThan(0);
    // The non-defaulted fields should all be missing.
    const missing = checks.filter((c) => c.status === "missing").map((c) => c.name);
    expect(missing).toContain("Cloudflare API token");
    expect(missing).toContain("Vercel token");
    expect(missing).toContain("Resend API key");
  });

  it("marks fields ok when present", () => {
    const checks = staticChecks({
      tokens: emptyTokens({
        cloudflareApiToken: "cf",
        cloudflareAccountId: "acc",
      }),
    });
    expect(
      checks.find((c) => c.name === "Cloudflare API token")?.status,
    ).toBe("ok");
  });
});

describe("doctor — live probes", () => {
  it("skips API probes when tokens are missing", async () => {
    const checks = await doctor({ tokens: emptyTokens() });
    const skips = checks.filter((c) => c.status === "skipped").map((c) => c.name);
    expect(skips).toEqual(
      expect.arrayContaining([
        "R2 bucket check",
        "DNS zone check",
        "Vercel env check",
        "Resend domain check",
      ]),
    );
  });

  it("reports R2 bucket as ok when listBuckets returns it", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = (async () => {
      calls++;
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            buckets: [{ name: "fishspotter-snippets", creation_date: "2026-01-01" }],
          },
          errors: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const checks = await doctor({
      tokens: emptyTokens({
        cloudflareApiToken: "cf",
        cloudflareAccountId: "acc",
      }),
      fetchImpl,
    });
    const r2 = checks.find((c) => c.name?.includes("R2 bucket"));
    expect(r2?.status).toBe("ok");
    expect(calls).toBeGreaterThan(0);
  });

  it("reports R2 bucket as missing when listBuckets returns a different bucket", async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: { buckets: [{ name: "other-bucket", creation_date: "x" }] },
          errors: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    const checks = await doctor({
      tokens: emptyTokens({
        cloudflareApiToken: "cf",
        cloudflareAccountId: "acc",
      }),
      fetchImpl,
    });
    const r2 = checks.find((c) => c.name?.includes("R2 bucket"));
    expect(r2?.status).toBe("missing");
    expect(r2?.detail).toContain("other-bucket");
  });
});

describe("maybe helper", () => {
  it("marks empty string as missing", () => {
    expect(__test__.maybe("x", "").status).toBe("missing");
  });
  it("marks undefined as missing", () => {
    expect(__test__.maybe("x", undefined).status).toBe("missing");
  });
  it("marks non-empty as ok", () => {
    expect(__test__.maybe("x", "abc").status).toBe("ok");
  });
});
