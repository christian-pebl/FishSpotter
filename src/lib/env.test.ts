import { describe, expect, it, vi } from "vitest";
import { reportEnvAtBoot, validateEnv } from "@/lib/env";

const COMPLETE = {
  POSTGRES_PRISMA_URL: "postgresql://u:p@localhost:5432/db",
  POSTGRES_URL_NON_POOLING: "postgresql://u:p@localhost:5432/db",
  NEXTAUTH_SECRET: "test-secret",
  NEXTAUTH_URL: "http://localhost:3000",
  SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
} as unknown as NodeJS.ProcessEnv;

describe("validateEnv", () => {
  it("passes a complete env and defaults the storage provider", () => {
    expect(validateEnv(COMPLETE).STORAGE_PROVIDER).toBe("supabase");
  });

  it("throws one error naming every missing required key", () => {
    const partial = { ...COMPLETE, NEXTAUTH_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "  " };
    expect(() => validateEnv(partial)).toThrow(/NEXTAUTH_URL[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("reportEnvAtBoot (the instrumentation hook)", () => {
  it("never throws on a bad env: it logs and returns false", () => {
    const log = vi.fn();
    const partial = { ...COMPLETE, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined };
    expect(() => reportEnvAtBoot(partial, log)).not.toThrow();
    expect(reportEnvAtBoot(partial, log)).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_SUPABASE_ANON_KEY is required"));
  });

  it("stays silent on a good env", () => {
    const log = vi.fn();
    expect(reportEnvAtBoot(COMPLETE, log)).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });
});
