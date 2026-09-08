"use server";

import { requireAdminSession } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";
import { sendOutcome, type SendOutcome } from "@/lib/email/outcome";
import { TestEmail } from "@/lib/email/templates/TestEmail";
import { SITE_URL } from "@/lib/site-url";

export interface TestSendResult {
  /** Where the message was addressed: the signed-in admin's own address. */
  to: string;
  outcome: SendOutcome;
  messageId?: string;
  /** The provider's own words on a failure, verbatim, for the person fixing it. */
  error?: string;
  sentAt: string;
}

/**
 * Send one test email to the signed-in admin and report exactly what
 * happened. This is the only way to see SendGrid's reason for refusing a
 * message (an unverified sender identity, a revoked key) without opening
 * Vercel's function logs, and the only way to prove end to end that a
 * message reaches an inbox. Admin-gated like every other admin action; the
 * recipient is never a parameter, so it cannot be turned into a relay.
 */
export async function sendTestEmail(): Promise<TestSendResult> {
  const { email } = await requireAdminSession();
  const sentAt = new Date().toISOString();
  const result = await sendEmail({
    to: email,
    subject: "FishSpotter test email",
    react: TestEmail({ sentBy: email, sentAt, siteUrl: SITE_URL }),
  });
  return {
    to: email,
    outcome: sendOutcome(result),
    messageId: result.messageId,
    error: result.error,
    sentAt,
  };
}
