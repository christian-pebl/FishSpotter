/**
 * Drift / idempotency check. Reports the live state of each
 * automated surface so the operator can see what's actually
 * configured vs what tokens.json wants.
 *
 * Designed to be safe to run as often as you like — pure read-only.
 */

import { CloudflareDnsClient } from "./cloudflare-dns";
import { CloudflareR2Client } from "./cloudflare-r2";
import { ResendClient } from "./resend-domain";
import { VercelClient } from "./vercel-env";
import type { BootstrapTokens } from "./config";

export interface CheckResult {
  name: string;
  status: "ok" | "missing" | "skipped";
  detail?: string;
}

export interface DoctorOptions {
  tokens: BootstrapTokens;
  expectedVercelEnvKeys?: string[];
  expectedGithubSecrets?: string[];
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Returns the synchronous portion of the check (token presence).
 * doctor() below adds live API probes on top.
 */
export function staticChecks(opts: DoctorOptions): CheckResult[] {
  const t = opts.tokens;
  const checks: CheckResult[] = [];
  checks.push(maybe("Cloudflare API token", t.cloudflareApiToken));
  checks.push(maybe("Cloudflare account ID", t.cloudflareAccountId));
  checks.push(maybe("R2 access key id", t.r2AccessKeyId));
  checks.push(maybe("R2 secret access key", t.r2SecretAccessKey));
  checks.push(maybe("R2 public URL", t.r2PublicUrl));
  checks.push(maybe("Vercel token", t.vercelToken));
  checks.push(maybe("Vercel project ID", t.vercelProjectId));
  checks.push(maybe("Resend API key", t.resendApiKey));
  checks.push(maybe("Resend domain", t.resendDomain));
  return checks;
}

/**
 * Live API probes. Each surface is gated by token presence; missing
 * tokens produce a "skipped" entry rather than an error.
 */
export async function doctor(opts: DoctorOptions): Promise<CheckResult[]> {
  const out: CheckResult[] = staticChecks(opts);
  const t = opts.tokens;

  if (t.cloudflareApiToken && t.cloudflareAccountId) {
    try {
      const r2 = new CloudflareR2Client({
        apiToken: t.cloudflareApiToken,
        accountId: t.cloudflareAccountId,
        fetchImpl: opts.fetchImpl,
      });
      const buckets = await r2.listBuckets();
      const target = t.r2BucketName ?? "fishspotter-snippets";
      out.push(
        buckets.includes(target)
          ? { name: `R2 bucket ${target}`, status: "ok" }
          : { name: `R2 bucket ${target}`, status: "missing", detail: `Exists: ${buckets.join(", ") || "(none)"}` },
      );
    } catch (err) {
      out.push({
        name: "R2 bucket check",
        status: "missing",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    out.push({ name: "R2 bucket check", status: "skipped", detail: "Cloudflare token / account ID missing" });
  }

  if (t.cloudflareApiToken && t.resendDomain) {
    try {
      const dns = new CloudflareDnsClient({
        apiToken: t.cloudflareApiToken,
        fetchImpl: opts.fetchImpl,
      });
      const zoneId = await dns.findZoneId(t.resendDomain);
      out.push(
        zoneId
          ? { name: `DNS zone ${t.resendDomain}`, status: "ok" }
          : { name: `DNS zone ${t.resendDomain}`, status: "missing", detail: "Zone not on Cloudflare — handle DNS manually" },
      );
    } catch (err) {
      out.push({
        name: "DNS zone check",
        status: "missing",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    out.push({ name: "DNS zone check", status: "skipped" });
  }

  if (t.vercelToken && t.vercelProjectId) {
    try {
      const v = new VercelClient({
        token: t.vercelToken,
        projectId: t.vercelProjectId,
        teamId: t.vercelTeamId,
        fetchImpl: opts.fetchImpl,
      });
      const envs = await v.listEnv();
      const present = new Set(envs.map((e) => e.key));
      const expected = opts.expectedVercelEnvKeys ?? [];
      const missing = expected.filter((k) => !present.has(k));
      out.push(
        missing.length === 0
          ? { name: "Vercel env vars", status: "ok", detail: `${expected.length} expected; all present` }
          : { name: "Vercel env vars", status: "missing", detail: `missing: ${missing.join(", ")}` },
      );
    } catch (err) {
      out.push({
        name: "Vercel env check",
        status: "missing",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    out.push({ name: "Vercel env check", status: "skipped" });
  }

  if (t.resendApiKey && t.resendDomain) {
    try {
      const r = new ResendClient({
        apiKey: t.resendApiKey,
        fetchImpl: opts.fetchImpl,
      });
      const found = await r.findDomain(t.resendDomain);
      out.push(
        found
          ? { name: `Resend domain ${t.resendDomain}`, status: "ok", detail: `status: ${found.status}` }
          : { name: `Resend domain ${t.resendDomain}`, status: "missing" },
      );
    } catch (err) {
      out.push({
        name: "Resend domain check",
        status: "missing",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    out.push({ name: "Resend domain check", status: "skipped" });
  }

  return out;
}

function maybe(name: string, value: string | undefined): CheckResult {
  return value
    ? { name, status: "ok" }
    : { name, status: "missing", detail: "not in tokens.json" };
}

export const __test__ = { maybe };
