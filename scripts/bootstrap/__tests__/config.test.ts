import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTokens, missingFor } from "../config";

let tmpDir: string;
let tokensPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-config-"));
  tokensPath = path.join(tmpDir, "tokens.json");
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadTokens", () => {
  it("returns empty config with a warning when the file is missing", () => {
    const r = loadTokens(tokensPath);
    expect(r.source).toBe("empty");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.tokens.r2BucketName).toBe("fishspotter-snippets"); // schema default
    expect(r.tokens.publicSiteUrl).toBe("https://fish-spotter.vercel.app");
  });

  it("parses a populated tokens.json", () => {
    writeFileSync(
      tokensPath,
      JSON.stringify({
        cloudflareApiToken: "cf_xxx",
        cloudflareAccountId: "acc_xxx",
        r2AccessKeyId: "AK",
        r2SecretAccessKey: "SK",
        r2PublicUrl: "https://pub-xxx.r2.dev",
        vercelToken: "vc_xxx",
        vercelProjectId: "prj_xxx",
        resendApiKey: "re_xxx",
        resendDomain: "pebl-cic.co.uk",
      }),
    );
    const r = loadTokens(tokensPath);
    expect(r.source).toBe("file");
    expect(r.tokens.cloudflareApiToken).toBe("cf_xxx");
    expect(r.tokens.r2BucketName).toBe("fishspotter-snippets");
  });

  it("rejects malformed JSON with a clear error", () => {
    writeFileSync(tokensPath, "{ not json");
    expect(() => loadTokens(tokensPath)).toThrow(/malformed JSON/);
  });

  it("rejects schema violations", () => {
    writeFileSync(tokensPath, JSON.stringify({ vercelProjectId: 123 }));
    expect(() => loadTokens(tokensPath)).toThrow();
  });

  it("validates URL fields", () => {
    writeFileSync(tokensPath, JSON.stringify({ r2PublicUrl: "not a url" }));
    expect(() => loadTokens(tokensPath)).toThrow();
  });
});

describe("missingFor", () => {
  it("reports missing keys per capability", () => {
    const r = loadTokens(tokensPath);
    expect(missingFor(r.tokens, "vercel-env")).toEqual([
      "vercelToken",
      "vercelProjectId",
    ]);
    expect(missingFor(r.tokens, "cloudflare-r2")).toEqual([
      "cloudflareApiToken",
      "cloudflareAccountId",
      "r2AccessKeyId",
      "r2SecretAccessKey",
      "r2PublicUrl",
    ]);
  });

  it("returns empty when all required keys are present", () => {
    writeFileSync(
      tokensPath,
      JSON.stringify({
        cloudflareApiToken: "cf",
        cloudflareAccountId: "acc",
        r2AccessKeyId: "AK",
        r2SecretAccessKey: "SK",
        r2PublicUrl: "https://pub.r2.dev",
      }),
    );
    const r = loadTokens(tokensPath);
    expect(missingFor(r.tokens, "cloudflare-r2")).toEqual([]);
  });
});
