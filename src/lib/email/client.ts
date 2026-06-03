/**
 * Email provider key accessor (S3-03).
 *
 * Provider: SendGrid (switched from Resend after the Wix DNS pivot —
 * Resend required a subdomain MX record that Wix's DNS editor can't add,
 * whereas SendGrid authenticates the domain with CNAME records Wix can
 * add). Sending is done via SendGrid's v3 REST API in ./send.ts, so no
 * SDK dependency is needed; this module just resolves + caches the key.
 *
 * Reads SENDGRID_API_KEY at first use. Returns null when unset so the
 * caller can no-op gracefully (token rows still persist; the missing
 * email is a deploy-config issue, not a code defect).
 */

let cached: string | null | undefined;

export function getSendgridApiKey(): string | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.SENDGRID_API_KEY;
  cached = apiKey && apiKey.length > 0 ? apiKey : null;
  return cached;
}
