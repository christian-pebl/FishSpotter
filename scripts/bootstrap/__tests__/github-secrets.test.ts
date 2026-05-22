import { describe, expect, it, vi } from "vitest";
import { GitHubSecretsClient } from "../github-secrets";

describe("GitHubSecretsClient.set", () => {
  it("invokes `gh secret set` with --body - and the value on stdin", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const client = new GitHubSecretsClient({ repo: "owner/repo", exec });
    const r = await client.set({ name: "MY_SECRET", value: "shhh" });
    expect(r.action).toBe("set");
    expect(exec).toHaveBeenCalledWith(
      "gh",
      ["secret", "set", "MY_SECRET", "--repo", "owner/repo", "--body", "-"],
      { input: "shhh" },
    );
  });

  it("setMany processes specs in order", async () => {
    const calls: string[] = [];
    const exec = vi.fn().mockImplementation(async (_cmd, args) => {
      calls.push(args[2]);
      return { stdout: "", stderr: "" };
    });
    const client = new GitHubSecretsClient({ repo: "o/r", exec });
    await client.setMany([
      { name: "A", value: "1" },
      { name: "B", value: "2" },
      { name: "C", value: "3" },
    ]);
    expect(calls).toEqual(["A", "B", "C"]);
  });
});

describe("GitHubSecretsClient.verify", () => {
  it("returns ok when gh auth status succeeds", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "Logged in", stderr: "" });
    const client = new GitHubSecretsClient({ repo: "o/r", exec });
    expect(await client.verify()).toEqual({ ok: true });
  });

  it("returns not-ok with a reason when gh auth status fails", async () => {
    const exec = vi.fn().mockRejectedValue(new Error("not logged in"));
    const client = new GitHubSecretsClient({ repo: "o/r", exec });
    const r = await client.verify();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not logged in");
  });
});
