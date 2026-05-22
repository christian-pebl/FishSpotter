/**
 * Mirror selected values to GitHub Actions secrets via the `gh` CLI.
 *
 * `gh secret set NAME --body VALUE -R owner/repo` handles the
 * public-key encryption for us. We just need gh to be authenticated;
 * the operator confirmed earlier that it is (PRs have merged).
 *
 * For tests we accept an exec impl as a dependency.
 */

import { execFile as execFileNode } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileNode);

export type GhExecutor = (
  cmd: string,
  args: string[],
  options?: { input?: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface GitHubSecretsClientOptions {
  repo: string; // owner/name
  /** Override for tests. */
  exec?: GhExecutor;
  /** When set, --token gets passed through GH_TOKEN env. */
  token?: string;
}

export interface SecretSpec {
  name: string;
  value: string;
}

export interface SecretSetResult {
  name: string;
  action: "set";
}

export class GitHubSecretsClient {
  private readonly repo: string;
  private readonly exec: GhExecutor;
  private readonly token?: string;

  constructor(opts: GitHubSecretsClientOptions) {
    this.repo = opts.repo;
    this.exec = opts.exec ?? defaultExec;
    this.token = opts.token;
  }

  async set(spec: SecretSpec): Promise<SecretSetResult> {
    // Use stdin (`--body -`) so the secret value never appears in argv
    // / process listings.
    await this.exec(
      "gh",
      ["secret", "set", spec.name, "--repo", this.repo, "--body", "-"],
      {
        input: spec.value,
      },
    );
    return { name: spec.name, action: "set" };
  }

  async setMany(specs: SecretSpec[]): Promise<SecretSetResult[]> {
    const out: SecretSetResult[] = [];
    for (const spec of specs) {
      out.push(await this.set(spec));
    }
    return out;
  }

  /**
   * Check that gh CLI is reachable + authenticated for this repo.
   */
  async verify(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      await this.exec("gh", ["auth", "status"], {});
    } catch (err) {
      return {
        ok: false,
        reason: `gh CLI not authenticated: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return { ok: true };
  }

  get env(): Record<string, string> {
    return this.token ? { GH_TOKEN: this.token } : {};
  }
}

const defaultExec: GhExecutor = async (cmd, args, options) => {
  const child = execFile(cmd, args, {
    env: { ...process.env },
    maxBuffer: 1024 * 1024,
  });
  if (options?.input !== undefined) {
    child.child.stdin?.write(options.input);
    child.child.stdin?.end();
  }
  return child;
};
