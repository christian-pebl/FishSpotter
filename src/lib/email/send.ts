/**
 * Typed `sendEmail` wrapper for transactional emails (S3-03).
 *
 * Provider: Resend REST API (switched from SendGrid on 15 Sep 2026, see
 * ./client.ts for why).
 *
 * Behaviour:
 *   - Never throws. Every path returns a SendEmailResult; classify it with
 *     `sendOutcome()` from ./outcome before telling anyone anything.
 *   - If RESEND_API_KEY / EMAIL_FROM_ADDRESS aren't set, nothing is sent and
 *     the result is `{ ok: true, skipped: true, error }`. `ok` stays true so
 *     the caller's own transaction (token write, account create) is never
 *     rolled back by a deploy-config gap, but the skip is logged at ERROR
 *     level, because a production deployment that silently sends nothing is
 *     not a warning (8 Sep 2026: a spotter pressed "resend" for days while the
 *     app said "Email sent").
 *   - In preview deploys (VERCEL_ENV !== "production"), the email is
 *     redirected to EMAIL_PREVIEW_CATCHALL (if set) so feature branches don't
 *     spam real users.
 *   - A Resend rejection or a network failure returns `{ ok: false, error }`
 *     carrying the provider's status and body, so the test send on
 *     /admin/email can show exactly what Resend objected to. The two that
 *     matter: 403 "domain is not verified" (the from address's domain has not
 *     passed Resend's DNS check) and 429 (Resend's 2 requests a second, or the
 *     free tier's 100 a day). SendGrid's version of the second, the `401
 *     Maximum credits exceeded` that stopped every email for six weeks, is the
 *     reason this result is never reduced to a boolean.
 */

import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { describeMissingEmailConfig, getEmailConfig } from "./client";
import type { SendEmailResult } from "./outcome";

export type { SendEmailResult } from "./outcome";

interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

function effectiveRecipient(to: string): string {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    const catchall = process.env.EMAIL_PREVIEW_CATCHALL;
    if (catchall) return catchall;
  }
  return to;
}

/** Logs carry the domain, never the mailbox: enough to debug, not enough to identify. */
function redact(address: string): string {
  const at = address.indexOf("@");
  return at > 0 ? `***${address.slice(at)}` : "***";
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend answers in well under a second. Past this it is an outage, and the
 * signup request that awaits this call must not hang on it.
 */
const SEND_TIMEOUT_MS = 10_000;

/**
 * The RFC 5322 display-name form Resend's `from` takes. Quotes and angle
 * brackets are stripped from the name, and it is quoted whenever it carries
 * anything beyond letters, digits, spaces and plain punctuation, so a comma in
 * a name someone sets one day ("PEBL CIC, FishSpotter") cannot be read as
 * address syntax.
 */
export function formatSender(name: string, address: string): string {
  const safeName = name.replace(/["\<>]/g, "").trim();
  if (!safeName) return address;
  const needsQuotes = /[^A-Za-z0-9 ._-]/.test(safeName);
  return needsQuotes ? `"${safeName}" <${address}>` : `${safeName} <${address}>`;
}

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: SendEmailArgs): Promise<SendEmailResult> {
  const config = getEmailConfig();
  const { apiKey, fromAddress } = config;

  if (!apiKey || !fromAddress) {
    const error = describeMissingEmailConfig(config.missing);
    // eslint-disable-next-line no-console
    console.error(`[email] ${error}; nothing sent`, { to: redact(to), subject });
    return { ok: true, skipped: true, error };
  }

  try {
    const recipient = effectiveRecipient(to);
    const html = await render(react);
    const text = await render(react, { plainText: true });
    const replyToAddress = replyTo ?? config.replyTo;

    const body: Record<string, unknown> = {
      from: formatSender(config.fromName, fromAddress),
      to: [recipient],
      subject,
      html,
      text,
    };
    if (replyToAddress) body.reply_to = replyToAddress;

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const error = `Resend ${res.status}: ${errBody.slice(0, 300)}`;
      // eslint-disable-next-line no-console
      console.error("[email] provider rejected the message", { to: redact(to), subject, error });
      return { ok: false, error };
    }

    // Resend answers 200 with `{ id }` for the message it accepted. An accepted
    // message with an unreadable body is still accepted, so the id is best effort.
    let messageId: string | undefined;
    try {
      const json = (await res.json()) as { id?: unknown };
      if (typeof json.id === "string" && json.id) messageId = json.id;
    } catch {
      messageId = undefined;
    }
    return { ok: true, messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw", { to: redact(to), subject, error });
    return { ok: false, error };
  }
}
