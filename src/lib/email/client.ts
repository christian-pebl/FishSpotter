/**
 * Email provider configuration (S3-03).
 *
 * Provider: Resend, since 15 Sep 2026. Until then it was SendGrid, whose free
 * plan had quietly become a 60-day trial: from early August every send was
 * refused with `401 Maximum credits exceeded`, the app swallowed the refusal
 * and said "Email sent", and nothing reached anyone for six weeks (see
 * docs/runbooks/transactional-email.md, section 7). Resend's free tier is
 * 3,000 emails a month, a year of FishSpotter's volume. The June 2026 reason
 * for picking SendGrid over Resend, that Resend needs an MX record and Wix's
 * DNS editor could not add one, went away when fishspotter.app moved to
 * Cloudflare DNS. Sending is done via Resend's REST API in ./send.ts, so no
 * SDK dependency is needed; this module only reads the env vars sending needs.
 *
 * Read from process.env on every call, not cached: the cost is nil, and a
 * cached "not configured" answer would outlive a fix in the same process (and
 * made the send path untestable without a cache reset).
 */

export interface EmailConfig {
  apiKey: string | null;
  fromAddress: string | null;
  fromName: string;
  replyTo: string | null;
  /** Names of the env vars sending needs that are not set. Empty means configured. */
  missing: string[];
}

const REQUIRED = ["RESEND_API_KEY", "EMAIL_FROM_ADDRESS"] as const;

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Any string map will do, so a test can hand in exactly the variables it means. */
type EnvLike = Readonly<Record<string, string | undefined>>;

export function getEmailConfig(env: EnvLike = process.env): EmailConfig {
  return {
    apiKey: nonEmpty(env.RESEND_API_KEY),
    fromAddress: nonEmpty(env.EMAIL_FROM_ADDRESS),
    fromName: nonEmpty(env.EMAIL_FROM_NAME) ?? "PEBL FishSpotter",
    replyTo: nonEmpty(env.EMAIL_REPLY_TO),
    missing: REQUIRED.filter((name) => !nonEmpty(env[name])),
  };
}

/**
 * True when both the API key and a from address are set. This says nothing
 * about whether Resend will ACCEPT mail from that address (a domain that is
 * not verified in Resend is a 403 at send time, an exhausted quota a 429); the
 * test send on /admin/email answers that question.
 */
export function isEmailConfigured(env: EnvLike = process.env): boolean {
  return getEmailConfig(env).missing.length === 0;
}

/** One sentence naming what is unset, for logs and results. */
export function describeMissingEmailConfig(missing: readonly string[]): string {
  return `Email is not configured (${missing.join(", ")} not set)`;
}
