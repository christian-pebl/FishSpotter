import { z } from "zod";

// Fail-fast environment-variable validation.
//
// This module is deliberately SIDE-EFFECT-FREE on import: it only declares a
// schema and a `validateEnv()` function. Nothing parses `process.env` at import
// time, so pulling this file into Next's static analysis during `next build`
// cannot throw and cannot crash the build. The single throw point is
// `validateEnv()`, which `instrumentation.ts` calls once at Node server boot
// (NEXT_RUNTIME === "nodejs"), giving a clear fail-fast at startup instead of a
// confusing downstream crash (e.g. a Prisma connection error 40 frames deep).
//
// REQUIRED keys are the ones the app genuinely cannot function without: the two
// Postgres URLs, the NextAuth secret + URL, and the Supabase URL/anon-key trio.
// Everything else is OPTIONAL so that an env missing, say, a SendGrid key or the
// R2 creds still boots (those features degrade gracefully or are unused). Being
// conservative here is intentional: over-constraining optional vars would break
// Vercel deploys that legitimately omit them.

// A required string env var: must be present and non-empty (after trimming).
// A missing var is `undefined` (caught by the type error param); a defined-but-
// blank var is "" (caught by .min(1)). Both surface the same readable message.
// (zod v4 dropped `required_error`; the message goes on `error` / `min`.)
const requiredString = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`);

// An optional string: absent is fine, but if present it must be non-empty.
// (A defined-but-blank optional var almost always signals a misconfiguration.)
const optionalString = z.string().trim().min(1).optional();

export const envSchema = z.object({
  // --- REQUIRED: the app cannot function without these ---------------------
  POSTGRES_PRISMA_URL: requiredString("POSTGRES_PRISMA_URL"),
  POSTGRES_URL_NON_POOLING: requiredString("POSTGRES_URL_NON_POOLING"),
  NEXTAUTH_SECRET: requiredString("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: requiredString("NEXTAUTH_URL"),
  SUPABASE_URL: requiredString("SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_URL: requiredString("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY"),

  // --- OPTIONAL: must never throw when absent ------------------------------
  // Supabase server-side extras
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: optionalString,

  // AI tools (Anthropic ID-guide chat, Gemini vision)
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: optionalString,

  // Transactional email (SendGrid)
  SENDGRID_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: optionalString,
  EMAIL_FROM_NAME: optionalString,
  EMAIL_REPLY_TO: optionalString,
  EMAIL_PREVIEW_CATCHALL: optionalString,

  // Cron auth
  CRON_SECRET: optionalString,

  // Storage provider. Defaults to "supabase" (the no-env-var default the
  // runtime already assumes). Optional everything-else for R2; R2 creds are
  // only consumed by the storage scripts, never the Next.js runtime, so they
  // stay optional even when STORAGE_PROVIDER === "r2".
  STORAGE_PROVIDER: z.enum(["r2", "supabase"]).default("supabase"),
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_URL: optionalString,

  // Feature flags / misc
  MCQ_CURATED_PHOTOS_ONLY: optionalString,
  NEXT_PUBLIC_SITE_URL: optionalString,
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate `process.env` against {@link envSchema}.
 *
 * On success, returns the parsed (and defaulted) env object. On failure, throws
 * a SINGLE Error whose message aggregates every missing or invalid required key
 * (one per line), prefixed "Invalid environment configuration:". Unknown extra
 * env vars are ignored (zod objects are non-strict by default), so this never
 * complains about the many unrelated vars Vercel/Node inject.
 *
 * This is the ONLY function in this module that throws. Call it from a server
 * entry point (see instrumentation.ts), never at import time.
 */
export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        const key = issue.path.join(".") || "(root)";
        return `  - ${key}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
