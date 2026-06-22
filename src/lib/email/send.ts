/**
 * Typed `sendEmail` wrapper for transactional emails (S3-03).
 *
 * Provider: SendGrid v3 REST API (switched from Resend — see ./client.ts).
 *
 * Behaviour:
 *   - If SENDGRID_API_KEY isn't set, log to console and return
 *     `{ ok: true, skipped: true }`. The caller is expected to treat
 *     this as success so token rows still get persisted; the missing
 *     email is a deploy-config issue, not a code defect.
 *   - In preview deploys (VERCEL_ENV !== "production"), the email is
 *     redirected to EMAIL_PREVIEW_CATCHALL (if set) so feature
 *     branches don't spam real users.
 *   - Errors from SendGrid are caught and logged; the caller's parent
 *     transaction (token write, account create, etc.) is not blocked.
 */

import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { getSendgridApiKey } from "./client";
import { fetchWithTimeout } from "@/lib/http";

interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

function effectiveRecipient(to: string): string {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    const catchall = process.env.EMAIL_PREVIEW_CATCHALL;
    if (catchall) return catchall;
  }
  return to;
}

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = getSendgridApiKey();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? "PEBL FishSpotter";

  if (!apiKey || !fromAddress) {
    // eslint-disable-next-line no-console
    console.warn("[email] SENDGRID_API_KEY / EMAIL_FROM_ADDRESS missing — skipping send.", { to, subject });
    return { ok: true, skipped: true };
  }

  try {
    const recipient = effectiveRecipient(to);
    const html = await render(react);
    const text = await render(react, { plainText: true });
    const replyToAddress = replyTo ?? process.env.EMAIL_REPLY_TO;

    const body: Record<string, unknown> = {
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: fromAddress, name: fromName },
      subject,
      // SendGrid requires text/plain before text/html (ascending MIME order).
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    };
    if (replyToAddress) body.reply_to = { email: replyToAddress };

    const res = await fetchWithTimeout(
      SENDGRID_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      15_000,
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[email] SendGrid error", res.status, errBody);
      return { ok: false, error: `SendGrid ${res.status}: ${errBody.slice(0, 200)}` };
    }

    // SendGrid returns 202 with an empty body; the id is in a header.
    const messageId = res.headers.get("x-message-id") ?? undefined;
    return { ok: true, messageId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
