/**
 * Resend domain registration. After the operator has signed up Resend
 * (manual, ~5 min, email confirm) and pasted the API key into
 * tokens.json, this module:
 *   - registers the sending domain if it doesn't already exist
 *   - retrieves the DKIM/SPF/DMARC records Resend expects
 *
 * cloudflare-dns.ts then writes those records.
 *
 * Resend API surface:
 *   GET    /domains                — list
 *   POST   /domains                — create
 *   GET    /domains/{id}           — fetch (includes DNS records)
 */

import type { DnsRecordSpec } from "./cloudflare-dns";

interface ResendDomainSummary {
  id: string;
  name: string;
  status: string;
}

interface ResendDnsRecord {
  type: "MX" | "TXT" | "CNAME";
  name: string;
  value: string;
  priority?: number;
  ttl?: string;
}

interface ResendDomainDetail extends ResendDomainSummary {
  records?: ResendDnsRecord[];
}

export interface ResendClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class ResendClient {
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: ResendClientOptions) {
    this.key = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.resend.com";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async listDomains(): Promise<ResendDomainSummary[]> {
    const data = await this.request<{ data: ResendDomainSummary[] }>("/domains");
    return data.data ?? [];
  }

  async findDomain(name: string): Promise<ResendDomainSummary | null> {
    const list = await this.listDomains();
    return list.find((d) => d.name === name) ?? null;
  }

  async createDomain(name: string): Promise<ResendDomainSummary> {
    return this.request<ResendDomainSummary>("/domains", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getDomain(id: string): Promise<ResendDomainDetail> {
    return this.request<ResendDomainDetail>(`/domains/${encodeURIComponent(id)}`);
  }

  /**
   * Returns the canonical DnsRecordSpec[] for the named domain, which
   * cloudflare-dns.ts can feed directly into upsertRecord.
   */
  async ensureDomainAndGetDnsRecords(name: string): Promise<DnsRecordSpec[]> {
    let domain = await this.findDomain(name);
    if (!domain) domain = await this.createDomain(name);
    const detail = await this.getDomain(domain.id);
    const records = detail.records ?? [];
    return records.map((r) => ({
      type: r.type,
      name: r.name,
      content: r.value,
      ttl: r.ttl ? Number(r.ttl) : undefined,
      ...(r.priority !== undefined ? { priority: r.priority } : {}),
    }));
  }
}
