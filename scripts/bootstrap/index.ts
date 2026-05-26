/**
 * Bootstrap orchestrator. Reads tokens.json, .env.local, and runs the
 * requested set of modules in the right order. Designed to be safely
 * idempotent — re-running it does no harm.
 *
 * Usage:
 *   npm run bootstrap                      # run the full sequence
 *   npm run bootstrap -- --doctor          # read-only state check
 *   npm run bootstrap -- --only vercel,gh  # subset
 *   npm run bootstrap -- --r2-migration    # include db:migrate-to-r2
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CloudflareDnsClient } from "./cloudflare-dns";
import { CloudflareR2Client } from "./cloudflare-r2";
import { GitHubSecretsClient } from "./github-secrets";
import { ResendClient } from "./resend-domain";
import {
  VercelClient,
  type VercelEnvSpec,
} from "./vercel-env";
import { doctor } from "./doctor";
import { generateCronSecret } from "./cron-secret";
import { generateVapidKeys } from "./vapid";
import type { DnsRecordSpec } from "./cloudflare-dns";
import { loadTokens, missingFor, type BootstrapTokens } from "./config";
import { dim, err, info, ok, step, warn } from "./log";
import { runDb } from "./db";

function printDnsChecklist(specs: DnsRecordSpec[]): void {
  for (const s of specs) {
    const extras: string[] = [];
    if (s.priority !== undefined) extras.push(`priority ${s.priority}`);
    if (s.ttl !== undefined) extras.push(`ttl ${s.ttl}`);
    const suffix = extras.length ? ` (${extras.join(", ")})` : "";
    dim(`  ${s.type.padEnd(5)} ${s.name}   →   ${s.content}${suffix}`);
  }
}

const MODULES = [
  "doctor",
  "secrets",
  "r2",
  "dns",
  "vercel",
  "github",
  "db",
] as const;
type ModuleKey = (typeof MODULES)[number];

function parseArgv(argv: string[]): {
  doctor: boolean;
  only: ModuleKey[] | null;
  includeR2Migration: boolean;
} {
  let doctorFlag = false;
  let only: ModuleKey[] | null = null;
  let includeR2Migration = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--doctor") doctorFlag = true;
    else if (a === "--r2-migration") includeR2Migration = true;
    else if (a === "--only") {
      const list = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean) as ModuleKey[];
      const bad = list.find((m) => !MODULES.includes(m));
      if (bad) throw new Error(`Unknown module "${bad}". Choices: ${MODULES.join(", ")}`);
      only = list;
    }
  }
  return { doctor: doctorFlag, only, includeR2Migration };
}

function shouldRun(only: ModuleKey[] | null, key: ModuleKey): boolean {
  if (!only) return true;
  return only.includes(key);
}

function readEnvLocal(): Record<string, string> {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function gitRepoFromRemote(): string | null {
  // Lazy parse so we don't depend on git on systems without it.
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const url = execSync("git config --get remote.origin.url", { encoding: "utf8" }).trim();
    // Support both SSH and HTTPS remote forms.
    const m =
      url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(\.git)?$/) ??
      null;
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));
  const { tokens, source, warnings } = loadTokens();
  if (source === "empty") {
    warn("Running with empty tokens.json — most steps will be skipped.");
    for (const w of warnings) dim(w);
  } else {
    info("tokens.json loaded.");
  }

  // Pre-compute generated values (CRON_SECRET, VAPID). We don't write
  // them to tokens.json — those are output values, not inputs. Just
  // hold them in memory so multiple modules can push them.
  const cronSecret = generateCronSecret();
  const vapid = await generateVapidKeys();

  const envLocal = readEnvLocal();
  const ghRepo = tokens.githubRepo ?? gitRepoFromRemote();

  // Vercel env specs derived from tokens + envLocal + generated values.
  const vercelSpecs: VercelEnvSpec[] = vercelEnvSpecs(tokens, envLocal, cronSecret, vapid);
  const expectedVercelKeys = vercelSpecs.map((s) => s.key);
  const expectedGhSecrets = ghSecretNames();

  if (args.doctor) {
    step("Doctor");
    const checks = await doctor({
      tokens,
      expectedVercelEnvKeys: expectedVercelKeys,
      expectedGithubSecrets: expectedGhSecrets,
    });
    for (const c of checks) {
      const fmt =
        c.status === "ok" ? ok : c.status === "missing" ? err : (m: string) => dim(m);
      fmt(`${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    }
    return;
  }

  if (shouldRun(args.only, "r2")) {
    step("Cloudflare R2");
    const missing = missingFor(tokens, "cloudflare-r2");
    if (missing.length) {
      warn(`Skipping R2: missing ${missing.join(", ")}.`);
    } else {
      const client = new CloudflareR2Client({
        apiToken: tokens.cloudflareApiToken!,
        accountId: tokens.cloudflareAccountId!,
      });
      const res = await client.ensureBucket(tokens.r2BucketName);
      ok(`bucket ${res.bucket} ${res.action}`);
    }
  }

  if (shouldRun(args.only, "vercel")) {
    step("Vercel env vars");
    const missing = missingFor(tokens, "vercel-env");
    if (missing.length) {
      warn(`Skipping Vercel: missing ${missing.join(", ")}.`);
    } else {
      const client = new VercelClient({
        token: tokens.vercelToken!,
        projectId: tokens.vercelProjectId!,
        teamId: tokens.vercelTeamId,
      });
      const results = await client.upsertMany(vercelSpecs);
      for (const r of results) ok(`${r.action} ${r.key} → ${r.targets.join(", ")}`);
    }
  }

  if (shouldRun(args.only, "github")) {
    step("GitHub Actions secrets");
    if (!ghRepo) {
      warn("Cannot determine GitHub repo (no git remote and no tokens.githubRepo).");
    } else {
      const client = new GitHubSecretsClient({ repo: ghRepo, token: tokens.githubToken });
      const verify = await client.verify();
      if (!verify.ok) {
        warn(verify.reason);
      } else {
        const specs = ghSecretSpecs(tokens, envLocal, cronSecret);
        const filtered = specs.filter((s) => s.value && s.value.trim() !== "");
        const skipped = specs.length - filtered.length;
        const results = await client.setMany(filtered);
        for (const r of results) ok(`set ${r.name}`);
        if (skipped > 0) {
          warn(`${skipped} GH secret(s) skipped — values not in tokens.json or .env.local.`);
        }
      }
    }
  }

  if (shouldRun(args.only, "dns")) {
    step("Resend domain + DNS records");
    if (!tokens.resendApiKey || !tokens.resendDomain) {
      warn(`Skipping: missing resendApiKey / resendDomain.`);
    } else {
      // 1. Always register the domain with Resend via API so the
      //    operator has DNS records to apply. Independent of where
      //    DNS itself lives.
      const resend = new ResendClient({ apiKey: tokens.resendApiKey });
      const specs = await resend.ensureDomainAndGetDnsRecords(tokens.resendDomain);
      ok(`Resend domain ${tokens.resendDomain} registered (${specs.length} DNS records to apply)`);

      // 2. If the DNS zone happens to be on Cloudflare, apply
      //    the records automatically. Otherwise emit a checklist
      //    for the operator to paste into the registrar manually.
      if (tokens.cloudflareApiToken) {
        const dns = new CloudflareDnsClient({ apiToken: tokens.cloudflareApiToken });
        const zoneId = await dns.findZoneId(tokens.resendDomain);
        if (zoneId) {
          for (const spec of specs) {
            const r = await dns.upsertRecord(zoneId, spec);
            ok(`${r.action} ${r.type} ${r.name}`);
          }
        } else {
          warn(`${tokens.resendDomain} is not hosted on Cloudflare — paste these records at your registrar:`);
          printDnsChecklist(specs);
        }
      } else {
        warn(`No cloudflareApiToken — paste these records at your registrar:`);
        printDnsChecklist(specs);
      }
    }
  }

  if (shouldRun(args.only, "db")) {
    step("Database");
    const outcomes = runDb({ includeR2Migration: args.includeR2Migration });
    for (const o of outcomes) {
      if (o.exitCode === 0) ok(`${o.script} succeeded`);
      else err(`${o.script} failed (exit ${o.exitCode})`);
    }
  }

  step("Summary");
  info(`CRON_SECRET generated this run: ${cronSecret.slice(0, 8)}… (${cronSecret.length} chars)`);
  info(`VAPID public key: ${vapid.publicKey.slice(0, 16)}…`);
  info("Re-run with --doctor any time to see drift.");
}

// ---------------------------------------------------------------- specs

function vercelEnvSpecs(
  tokens: BootstrapTokens,
  envLocal: Record<string, string>,
  cronSecret: string,
  vapid: { publicKey: string; privateKey: string },
): VercelEnvSpec[] {
  const specs: VercelEnvSpec[] = [];
  function add(key: string, value: string | undefined, type: VercelEnvSpec["type"] = "encrypted"): void {
    if (!value) return;
    specs.push({ key, value, type });
  }

  // Public.
  add("NEXTAUTH_URL", tokens.publicSiteUrl, "plain");
  add("STORAGE_PROVIDER", tokens.r2AccessKeyId ? "r2" : "supabase", "plain");
  add("R2_PUBLIC_URL", tokens.r2PublicUrl, "plain");
  add("R2_BUCKET_NAME", tokens.r2BucketName, "plain");
  add("EMAIL_FROM_NAME", "PEBL FishSpotter", "plain");
  add("SUPABASE_STORAGE_BUCKET", envLocal.SUPABASE_STORAGE_BUCKET ?? "snippets", "plain");

  // Secrets.
  add("NEXTAUTH_SECRET", envLocal.NEXTAUTH_SECRET);
  add("POSTGRES_PRISMA_URL", envLocal.POSTGRES_PRISMA_URL);
  add("POSTGRES_URL_NON_POOLING", envLocal.POSTGRES_URL_NON_POOLING);
  add("NEXT_PUBLIC_SUPABASE_URL", envLocal.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.SUPABASE_URL);
  add("SUPABASE_URL", envLocal.SUPABASE_URL);
  add("NEXT_PUBLIC_SUPABASE_ANON_KEY", envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  add("SUPABASE_SERVICE_ROLE_KEY", envLocal.SUPABASE_SERVICE_ROLE_KEY);
  add("ANTHROPIC_API_KEY", envLocal.ANTHROPIC_API_KEY);
  if (envLocal.ANTHROPIC_MODEL) add("ANTHROPIC_MODEL", envLocal.ANTHROPIC_MODEL);

  // R2.
  add("R2_ACCOUNT_ID", tokens.cloudflareAccountId);
  add("R2_ACCESS_KEY_ID", tokens.r2AccessKeyId);
  add("R2_SECRET_ACCESS_KEY", tokens.r2SecretAccessKey);

  // Resend.
  add("RESEND_API_KEY", tokens.resendApiKey);
  if (tokens.resendDomain) {
    add("EMAIL_FROM_ADDRESS", `noreply@${tokens.resendDomain}`, "plain");
    add("EMAIL_REPLY_TO", `hello@${tokens.resendDomain}`, "plain");
  }

  // Cron + push.
  add("CRON_SECRET", cronSecret);
  add("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.publicKey, "plain");
  add("VAPID_PRIVATE_KEY", vapid.privateKey);

  return specs;
}

function ghSecretNames(): string[] {
  return [
    "NEXTAUTH_SECRET",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "ANTHROPIC_API_KEY",
  ];
}

function ghSecretSpecs(
  tokens: BootstrapTokens,
  envLocal: Record<string, string>,
  cronSecret: string,
): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  function add(name: string, value: string | undefined): void {
    if (!value) return;
    out.push({ name, value });
  }
  add("NEXTAUTH_SECRET", envLocal.NEXTAUTH_SECRET);
  add("POSTGRES_PRISMA_URL", envLocal.POSTGRES_PRISMA_URL);
  add("POSTGRES_URL_NON_POOLING", envLocal.POSTGRES_URL_NON_POOLING);
  add("NEXT_PUBLIC_SUPABASE_URL", envLocal.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.SUPABASE_URL);
  add("SUPABASE_URL", envLocal.SUPABASE_URL);
  add("NEXT_PUBLIC_SUPABASE_ANON_KEY", envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  add("SUPABASE_SERVICE_ROLE_KEY", envLocal.SUPABASE_SERVICE_ROLE_KEY);
  add("CRON_SECRET", cronSecret);
  add("ANTHROPIC_API_KEY", envLocal.ANTHROPIC_API_KEY);
  // Resend, R2 etc. aren't needed in GH Actions (the workflows don't
  // touch those services); kept out deliberately.
  return out;
}

// Export for unit-test visibility (vercelEnvSpecs / ghSecretSpecs are
// pure functions of input config).
export const __test__ = { parseArgv, readEnvLocal, vercelEnvSpecs, ghSecretSpecs, ghSecretNames };

// ---------------------------------------------------------------- run

if (require.main === module) {
  main().catch((e) => {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
