/**
 * Bootstrap config: shared types + tokens.json loader.
 *
 * tokens.json is gitignored. The operator fetches each token once
 * (Cloudflare, Vercel, GitHub, Resend) and pastes them here. Every
 * other module in this directory reads from this loader so we never
 * sprinkle process.env lookups across the kit.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// ---------------------------------------------------------------- Schema

const BootstrapTokensSchema = z.object({
  /** Cloudflare API token with `Account.Cloudflare R2 Storage:Edit`. */
  cloudflareApiToken: z.string().min(1).optional(),
  /** Cloudflare account ID — visible top-right of every dashboard URL. */
  cloudflareAccountId: z.string().min(1).optional(),
  /** R2 S3-API access key (dashboard-only mint). */
  r2AccessKeyId: z.string().min(1).optional(),
  r2SecretAccessKey: z.string().min(1).optional(),
  /** R2 bucket name. Defaults to "fishspotter-snippets". */
  r2BucketName: z.string().min(1).default("fishspotter-snippets"),
  /** Public-facing URL for objects in the bucket (e.g. pub-XXX.r2.dev). */
  r2PublicUrl: z.string().url().optional(),

  /** Vercel personal access token. */
  vercelToken: z.string().min(1).optional(),
  /** Vercel project ID (prj_…) or project slug. */
  vercelProjectId: z.string().min(1).optional(),
  /** Vercel team ID, if the project lives under a team. */
  vercelTeamId: z.string().min(1).optional(),

  /** Resend API key (re_…). Account signup is manual; this comes after. */
  resendApiKey: z.string().min(1).optional(),
  /** Sending domain — e.g. pebl-cic.co.uk. */
  resendDomain: z.string().min(1).optional(),

  /** GitHub PAT for setting Actions secrets. Optional — falls back to gh CLI. */
  githubToken: z.string().min(1).optional(),
  /** Repo in owner/name format. Defaults to the project's git remote. */
  githubRepo: z.string().regex(/^[^/]+\/[^/]+$/).optional(),

  /** Public site URL the env vars should point at. */
  publicSiteUrl: z.string().url().default("https://fish-spotter.vercel.app"),
});

export type BootstrapTokens = z.infer<typeof BootstrapTokensSchema>;

// ---------------------------------------------------------------- Loader

export function tokensPath(): string {
  return path.join(process.cwd(), "scripts", "bootstrap", "tokens.json");
}

export interface LoadResult {
  tokens: BootstrapTokens;
  source: "file" | "empty";
  warnings: string[];
}

/**
 * Loads tokens.json if present, returns parsed config plus any
 * non-fatal warnings about missing fields. Hard-fails only on
 * malformed JSON / type errors — missing fields are a runtime
 * concern that each module raises when it needs the value.
 */
export function loadTokens(jsonPath: string = tokensPath()): LoadResult {
  if (!existsSync(jsonPath)) {
    return {
      tokens: BootstrapTokensSchema.parse({}),
      source: "empty",
      warnings: [
        `tokens.json not found at ${jsonPath}.`,
        "Copy tokens.json.example → tokens.json and fill in the values you have.",
      ],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (err) {
    throw new Error(
      `tokens.json is malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = BootstrapTokensSchema.parse(raw);
  return { tokens: parsed, source: "file", warnings: [] };
}

// ---------------------------------------------------------------- Required-field check

export type Capability =
  | "cloudflare-r2"
  | "cloudflare-dns"
  | "vercel-env"
  | "resend-domain"
  | "github-secrets";

/**
 * For a given capability, returns the list of missing token fields.
 * The orchestrator uses this to skip-with-message instead of crashing.
 */
export function missingFor(tokens: BootstrapTokens, capability: Capability): string[] {
  const need = REQUIRED[capability];
  return need.filter((k) => !tokens[k as keyof BootstrapTokens]);
}

const REQUIRED: Record<Capability, Array<keyof BootstrapTokens>> = {
  "cloudflare-r2": [
    "cloudflareApiToken",
    "cloudflareAccountId",
    "r2AccessKeyId",
    "r2SecretAccessKey",
    "r2PublicUrl",
  ],
  "cloudflare-dns": ["cloudflareApiToken", "resendDomain"],
  "vercel-env": ["vercelToken", "vercelProjectId"],
  "resend-domain": ["resendApiKey", "resendDomain"],
  "github-secrets": [], // gh CLI fallback; githubToken optional.
};

export const __test__ = { BootstrapTokensSchema, REQUIRED };
