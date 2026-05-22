import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __test__ } from "../index";
import { loadTokens } from "../config";

const { parseArgv, readEnvLocal, vercelEnvSpecs, ghSecretSpecs, ghSecretNames } = __test__;

describe("parseArgv", () => {
  it("returns defaults when no args", () => {
    const r = parseArgv([]);
    expect(r).toEqual({ doctor: false, only: null, includeR2Migration: false });
  });
  it("--doctor flag", () => {
    expect(parseArgv(["--doctor"]).doctor).toBe(true);
  });
  it("--r2-migration flag", () => {
    expect(parseArgv(["--r2-migration"]).includeR2Migration).toBe(true);
  });
  it("--only with valid modules", () => {
    expect(parseArgv(["--only", "vercel,github"]).only).toEqual(["vercel", "github"]);
  });
  it("--only with unknown module throws", () => {
    expect(() => parseArgv(["--only", "vercel,bogus"])).toThrow(/Unknown module "bogus"/);
  });
});

describe("readEnvLocal", () => {
  let tmpDir: string;
  let cwdSpy: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "bootstrap-env-"));
    cwdSpy = process.cwd();
    process.chdir(tmpDir);
  });
  afterEach(() => {
    process.chdir(cwdSpy);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when .env.local is missing", () => {
    expect(readEnvLocal()).toEqual({});
  });

  it("parses simple key=value pairs", () => {
    writeFileSync(
      ".env.local",
      ["A=1", "B=two words", "# C=ignored", "", "D=42"].join("\n"),
    );
    expect(readEnvLocal()).toEqual({ A: "1", B: "two words", D: "42" });
  });

  it("strips surrounding double or single quotes", () => {
    writeFileSync(".env.local", `K="quoted value"\nL='another'`);
    expect(readEnvLocal()).toEqual({ K: "quoted value", L: "another" });
  });
});

describe("vercelEnvSpecs", () => {
  it("emits no secret specs when no values are present", () => {
    const { tokens } = loadTokens(path.join("/", "tmp", "no-such-file"));
    const specs = vercelEnvSpecs(tokens, {}, "cron-secret", {
      publicKey: "pub",
      privateKey: "priv",
    });
    const keys = specs.map((s) => s.key);
    // STORAGE_PROVIDER, R2_BUCKET_NAME, NEXTAUTH_URL, etc default to plain values.
    expect(keys).toContain("NEXTAUTH_URL");
    expect(keys).toContain("R2_BUCKET_NAME");
    expect(keys).toContain("CRON_SECRET");
    expect(keys).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    expect(keys).toContain("VAPID_PRIVATE_KEY");
  });

  it("sets STORAGE_PROVIDER=r2 when an R2 access key is supplied", () => {
    const { tokens } = loadTokens(path.join("/", "tmp", "no-such-file"));
    tokens.r2AccessKeyId = "AK";
    const specs = vercelEnvSpecs(tokens, {}, "x", { publicKey: "p", privateKey: "q" });
    expect(specs.find((s) => s.key === "STORAGE_PROVIDER")?.value).toBe("r2");
  });

  it("pulls supabase + db creds from .env.local", () => {
    const { tokens } = loadTokens(path.join("/", "tmp", "no-such-file"));
    const envLocal = {
      POSTGRES_PRISMA_URL: "postgres://x",
      POSTGRES_URL_NON_POOLING: "postgres://y",
      NEXTAUTH_SECRET: "sec",
      SUPABASE_URL: "https://s",
      SUPABASE_SERVICE_ROLE_KEY: "srv",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      ANTHROPIC_API_KEY: "k",
    };
    const specs = vercelEnvSpecs(tokens, envLocal, "cron", { publicKey: "p", privateKey: "q" });
    const byKey = Object.fromEntries(specs.map((s) => [s.key, s.value]));
    expect(byKey.POSTGRES_PRISMA_URL).toBe("postgres://x");
    expect(byKey.NEXTAUTH_SECRET).toBe("sec");
    expect(byKey.ANTHROPIC_API_KEY).toBe("k");
  });

  it("includes EMAIL_FROM_ADDRESS only when resendDomain is set", () => {
    const { tokens } = loadTokens(path.join("/", "tmp", "no-such-file"));
    tokens.resendDomain = "pebl-cic.co.uk";
    const specs = vercelEnvSpecs(tokens, {}, "x", { publicKey: "p", privateKey: "q" });
    const v = specs.find((s) => s.key === "EMAIL_FROM_ADDRESS")?.value;
    expect(v).toBe("noreply@pebl-cic.co.uk");
  });
});

describe("ghSecretSpecs + ghSecretNames", () => {
  it("only includes secrets actually present in env / tokens", () => {
    const { tokens } = loadTokens(path.join("/", "tmp", "no-such-file"));
    const specs = ghSecretSpecs(tokens, {}, "cron");
    expect(specs.find((s) => s.name === "CRON_SECRET")?.value).toBe("cron");
    expect(specs.find((s) => s.name === "POSTGRES_PRISMA_URL")).toBeUndefined();
  });

  it("returns the expected name list", () => {
    expect(ghSecretNames()).toContain("CRON_SECRET");
    expect(ghSecretNames()).toContain("NEXTAUTH_SECRET");
    expect(ghSecretNames()).toContain("POSTGRES_PRISMA_URL");
  });
});
