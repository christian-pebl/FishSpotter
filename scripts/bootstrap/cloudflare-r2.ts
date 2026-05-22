/**
 * Cloudflare R2 bucket provisioning.
 *
 * R2's API surface here:
 *   GET    /accounts/{id}/r2/buckets          — list
 *   POST   /accounts/{id}/r2/buckets          — create
 *
 * R2 S3-compatible Access Keys are minted via the dashboard (one-time
 * shown) so this script doesn't try to generate them — it expects them
 * to already be in tokens.json. The script's job is to make sure the
 * bucket exists and surface the public-URL pattern for the env var.
 */

export interface CloudflareR2ClientOptions {
  apiToken: string;
  accountId: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface BucketListResponse {
  result: { buckets: Array<{ name: string; creation_date: string }> };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

interface BucketCreateResponse {
  result: { name: string };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

export interface EnsureBucketResult {
  bucket: string;
  action: "created" | "existed";
}

export class CloudflareR2Client {
  private readonly token: string;
  private readonly accountId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: CloudflareR2ClientOptions) {
    this.token = opts.apiToken;
    this.accountId = opts.accountId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.cloudflare.com/client/v4";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as T & {
      success?: boolean;
      errors?: Array<{ code: number; message: string }>;
    };
    if (!res.ok || (body && body.success === false)) {
      const msg = body?.errors?.map((e) => `${e.code} ${e.message}`).join("; ") ?? res.statusText;
      throw new Error(`Cloudflare API ${res.status}: ${msg}`);
    }
    return body;
  }

  async listBuckets(): Promise<string[]> {
    const res = await this.request<BucketListResponse>(
      `/accounts/${encodeURIComponent(this.accountId)}/r2/buckets`,
    );
    return res.result.buckets.map((b) => b.name);
  }

  async ensureBucket(name: string): Promise<EnsureBucketResult> {
    const existing = await this.listBuckets();
    if (existing.includes(name)) return { bucket: name, action: "existed" };
    await this.request<BucketCreateResponse>(
      `/accounts/${encodeURIComponent(this.accountId)}/r2/buckets`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
    return { bucket: name, action: "created" };
  }
}
