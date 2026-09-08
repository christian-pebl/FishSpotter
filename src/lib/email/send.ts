/**
 * Typed `sendEmail` wrapper for transactional emails (S3-03).
 *
 * Provider: SendGrid v3 REST API (switched from Resend, see ./client.ts).
 *
 * Behaviour:
 *   - Never throws. Every path returns a SendEmailResult; classify it with
 *     `sendOutcome()` from ./outcome before telling anyone anything.
 *   - If SENDGRID_API_KEY / EMAIL_FROM_ADDRESS aren't set, nothing is sent and
 *     the result is `{ ok: true, skipped: true, error }`. `ok` stays true so
 *     the caller's own transaction (token write, account create) is never
 *     rolled back by a deploy-config gap, but the skip is logged at ERROR
 *     level, because a production deployment that silently sends nothing is
 *     not a warning (8 Sep 2026: a spotter pressed "resend" for days while the
 *     app said "Email sent").
 *   - In preview deploys (VERCEL_ENV !== "production"), the email is
 *     redirected to EMAIL_PREVIEW_CATCHALL (if set) so feature branches don't
 *     spam real users.
 *   - A SendGrid rejection or a network failure returns `{ ok: false, error }`
 *     carrying the provider's status and body, so the test send on
 *     /admin/email can show exactly what SendGrid objected to.
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

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

/**
 * SendGrid answers in well under a second. Past this it is an outage, and the
 * signup request that awaits this call must not hang on it.
 */
const SEND_TIMEOUT_MS = 10_000;

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
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: fromAddress, name: config.fromName },
      subject,
      // SendGrid requires text/plain before text/html (ascending MIME order).
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    };
    if (replyToAddress) body.reply_to = { email: replyToAddress };

    const res = await fetch(SENDGRID_ENDPOINT, {
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
      const error = `SendGrid ${res.status}: ${errBody.slice(0, 300)}`;
      // eslint-disable-next-line no-console
      console.error("[email] provider rejected the message", { to: redact(to), subject, error });
      return { ok: false, error };
    }

    // SendGrid returns 202 with an empty body; the id is in a header.
    const messageId = res.headers.get("x-message-id") ?? undefined;
    return { ok: true, messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw", { to: redact(to), subject, error });
    return { ok: false, error };
  }
}
