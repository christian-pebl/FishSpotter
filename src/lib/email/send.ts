/**
 * Typed `sendEmail` wrapper for transactional emails (S3-03).
 *
 * Behaviour:
 *   - If RESEND_API_KEY isn't set, log to console and return
 *     `{ ok: true, skipped: true }`. The caller is expected to treat
 *     this as success so token rows still get persisted; the missing
 *     email is a deploy-config issue, not a code defect.
 *   - In preview deploys (VERCEL_ENV !== "production"), the email is
 *     redirected to EMAIL_PREVIEW_CATCHALL (if set) so feature
 *     branches don't spam real users.
 *   - Errors from Resend are caught and logged; the caller's parent
 *     transaction (token write, account create, etc.) is not blocked.
 */

import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { getResend } from "./client";

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

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: SendEmailArgs): Promise<SendEmailResult> {
  const resend = getResend();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? "PEBL FishSpotter";

  if (!resend || !fromAddress) {
    // eslint-disable-next-line no-console
    console.warn("[email] RESEND_API_KEY / EMAIL_FROM_ADDRESS missing — skipping send.", { to, subject });
    return { ok: true, skipped: true };
  }

  try {
    const recipient = effectiveRecipient(to);
    const html = await render(react);
    const text = await render(react, { plainText: true });
    const result = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: recipient,
      subject,
      html,
      text,
      replyTo: replyTo ?? process.env.EMAIL_REPLY_TO,
    });
    if (result.error) {
      // eslint-disable-next-line no-console
      console.error("[email] Resend error", result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, messageId: result.data?.id };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
