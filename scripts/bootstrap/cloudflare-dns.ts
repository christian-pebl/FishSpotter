/**
 * Cloudflare DNS record manager. Used for the DKIM/SPF/DMARC records
 * Resend needs on pebl-cic.co.uk.
 *
 * If the zone isn't on Cloudflare, listZones() returns empty and the
 * orchestrator emits a manual checklist instead of failing.
 *
 * API surface:
 *   GET  /zones?name=…
 *   GET  /zones/{id}/dns_records
 *   POST /zones/{id}/dns_records
 *   PATCH /zones/{id}/dns_records/{id}
 */

export interface DnsRecordSpec {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX";
  name: string;     // full subdomain, e.g. "fishspotter._domainkey.pebl-cic.co.uk"
  content: string;  // record value
  ttl?: number;     // seconds; default 1 (= auto)
  priority?: number; // MX only
}

interface DnsRecordRow extends DnsRecordSpec {
  id: string;
  zone_id: string;
}

export interface UpsertRecordResult {
  name: string;
  type: DnsRecordSpec["type"];
  action: "created" | "updated" | "unchanged";
}

export interface CloudflareDnsClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class CloudflareDnsClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: CloudflareDnsClientOptions) {
    this.token = opts.apiToken;
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
    if (!res.ok || body?.success === false) {
      const msg = body?.errors?.map((e) => `${e.code} ${e.message}`).join("; ") ?? res.statusText;
      throw new Error(`Cloudflare DNS API ${res.status}: ${msg}`);
    }
    return body;
  }

  /** Returns zone ID if Cloudflare hosts the zone; null otherwise. */
  async findZoneId(rootDomain: string): Promise<string | null> {
    const res = await this.request<{
      result: Array<{ id: string; name: string }>;
    }>(`/zones?name=${encodeURIComponent(rootDomain)}`);
    return res.result[0]?.id ?? null;
  }

  async listRecords(zoneId: string): Promise<DnsRecordRow[]> {
    const res = await this.request<{ result: DnsRecordRow[] }>(
      `/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=200`,
    );
    return res.result;
  }

  /**
   * Idempotent: if a record of the same {name, type, content} exists,
   * it's a no-op. If only name+type matches, we update the content.
   * Otherwise we create.
   */
  async upsertRecord(zoneId: string, spec: DnsRecordSpec): Promise<UpsertRecordResult> {
    const records = await this.listRecords(zoneId);
    const sameKey = records.filter((r) => r.name === spec.name && r.type === spec.type);
    const exactMatch = sameKey.find((r) => r.content === spec.content);
    if (exactMatch) {
      return { name: spec.name, type: spec.type, action: "unchanged" };
    }
    if (sameKey.length === 1) {
      await this.request(
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${sameKey[0].id}`,
        { method: "PATCH", body: JSON.stringify(spec) },
      );
      return { name: spec.name, type: spec.type, action: "updated" };
    }
    await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: "POST",
      body: JSON.stringify(spec),
    });
    return { name: spec.name, type: spec.type, action: "created" };
  }
}
