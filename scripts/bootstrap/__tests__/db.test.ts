import { describe, expect, it, vi } from "vitest";
import { runDb } from "../db";

describe("runDb", () => {
  it("runs db:push and db:seed-aliases by default, skips db:migrate-to-r2", () => {
    const run = vi.fn().mockImplementation((script: string) => ({
      script,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    }));
    const outcomes = runDb({ run });
    expect(outcomes.map((o) => o.script)).toEqual(["db:push", "db:seed-aliases"]);
  });

  it("includes db:migrate-to-r2 when requested", () => {
    const run = vi.fn().mockImplementation((script: string) => ({
      script,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    }));
    const outcomes = runDb({ run, includeR2Migration: true });
    expect(outcomes.map((o) => o.script)).toEqual([
      "db:push",
      "db:seed-aliases",
      "db:migrate-to-r2",
    ]);
  });

  it("stops the chain on first non-zero exit", () => {
    const run = vi.fn().mockImplementation((script: string) => ({
      script,
      exitCode: script === "db:push" ? 1 : 0,
      stdout: "",
      stderr: "failed",
    }));
    const outcomes = runDb({ run, includeR2Migration: true });
    expect(outcomes.map((o) => o.script)).toEqual(["db:push"]);
    expect(outcomes[0].exitCode).toBe(1);
  });
});
