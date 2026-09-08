/**
 * Email provider configuration (S3-03).
 *
 * Provider: SendGrid (switched from Resend after the Wix DNS pivot: Resend
 * required a subdomain MX record that Wix's DNS editor can't add, whereas
 * SendGrid authenticates the domain with CNAME records Wix can add). Sending
 * is done via SendGrid's v3 REST API in ./send.ts, so no SDK dependency is
 * needed; this module only reads the env vars sending needs.
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

const REQUIRED = ["SENDGRID_API_KEY", "EMAIL_FROM_ADDRESS"] as const;

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  return {
    apiKey: nonEmpty(env.SENDGRID_API_KEY),
    fromAddress: nonEmpty(env.EMAIL_FROM_ADDRESS),
    fromName: nonEmpty(env.EMAIL_FROM_NAME) ?? "PEBL FishSpotter",
    replyTo: nonEmpty(env.EMAIL_REPLY_TO),
    missing: REQUIRED.filter((name) => !nonEmpty(env[name])),
  };
}

/**
 * True when both the API key and a from address are set. This says nothing
 * about whether SendGrid will ACCEPT mail from that address (an unverified
 * sender identity is a 403 at send time); the test send on /admin/email
 * answers that question.
 */
export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getEmailConfig(env).missing.length === 0;
}

/** One sentence naming what is unset, for logs and results. */
export function describeMissingEmailConfig(missing: readonly string[]): string {
  return `Email is not configured (${missing.join(", ")} not set)`;
}
