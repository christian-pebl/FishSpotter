/**
 * Vercel env-var manager. Idempotent upsert of project env vars across
 * production + preview targets.
 *
 * Vercel REST API surface used:
 *   GET    /v9/projects/{idOrName}/env       — list existing
 *   POST   /v10/projects/{idOrName}/env      — create
 *   PATCH  /v9/projects/{idOrName}/env/{id}  — update
 *   DELETE /v9/projects/{idOrName}/env/{id}  — remove
 *
 * For tests we accept a `fetch` impl as a dependency.
 */

export type VercelTarget = "production" | "preview" | "development";

export interface VercelEnvSpec {
  key: string;
  value: string;
  targets?: VercelTarget[];
  /** "encrypted" (default) | "plain" — only relevant for non-secret values like the public URL. */
  type?: "encrypted" | "plain";
}

interface VercelEnvRow {
  id: string;
  key: string;
  value?: string;
  type: "encrypted" | "plain" | "system" | "secret" | "sensitive";
  target?: VercelTarget[];
}

export interface VercelClientOptions {
  token: string;
  projectId: string;
  teamId?: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  /** Override for tests — defaults to Vercel API. */
  baseUrl?: string;
}

export interface UpsertResult {
  key: string;
  action: "created" | "updated" | "unchanged";
  targets: VercelTarget[];
}

export class VercelClient {
  private readonly token: string;
  private readonly projectId: string;
  private readonly teamId?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: VercelClientOptions) {
    this.token = opts.token;
    this.projectId = opts.projectId;
    this.teamId = opts.teamId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.vercel.com";
  }

  private url(path: string): string {
    const u = new URL(`${this.baseUrl}${path}`);
    if (this.teamId) u.searchParams.set("teamId", this.teamId);
    return u.toString();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(this.url(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Vercel API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async listEnv(): Promise<VercelEnvRow[]> {
    const data = await this.request<{ envs: VercelEnvRow[] }>(
      `/v9/projects/${encodeURIComponent(this.projectId)}/env?decrypt=false`,
    );
    return data.envs ?? [];
  }

  async upsert(spec: VercelEnvSpec): Promise<UpsertResult> {
    const targets = spec.targets ?? ["production", "preview"];
    const existing = (await this.listEnv()).filter((row) => row.key === spec.key);

    // Multiple rows can exist with different target slices. Easiest
    // idempotent path: delete all existing rows for this key, then
    // create a single row spanning the requested targets. Avoids
    // partial-target drift.
    if (existing.length > 0) {
      for (const row of existing) {
        await this.request(
          `/v9/projects/${encodeURIComponent(this.projectId)}/env/${row.id}`,
          { method: "DELETE" },
        );
      }
    }
    await this.request(`/v10/projects/${encodeURIComponent(this.projectId)}/env`, {
      method: "POST",
      body: JSON.stringify({
        key: spec.key,
        value: spec.value,
        type: spec.type ?? "encrypted",
        target: targets,
      }),
    });
    return {
      key: spec.key,
      action: existing.length > 0 ? "updated" : "created",
      targets,
    };
  }

  async upsertMany(specs: VercelEnvSpec[]): Promise<UpsertResult[]> {
    const out: UpsertResult[] = [];
    for (const spec of specs) {
      out.push(await this.upsert(spec));
    }
    return out;
  }
}
