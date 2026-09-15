/**
 * Higher-level email dispatchers, these own the token creation + the
 * outbound send so the calling code doesn't have to duplicate the
 * token / hash / URL plumbing every time.
 */

import { SITE_URL } from "@/lib/site-url";
import { VerificationEmail } from "@/lib/email/templates/VerificationEmail";
import { sendEmail } from "@/lib/email/send";
import { describeMissingEmailConfig, getEmailConfig } from "@/lib/email/client";
import type { SendEmailResult } from "@/lib/email/outcome";
import {
  VERIFICATION_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";

function baseUrl(): string {
  return SITE_URL;
}

/**
 * Generate a verification token, persist its hash, send the email. Never
 * throws: the caller's own transaction must not be blocked by email
 * infrastructure. It DOES report: the result says whether the message left,
 * and every caller that tells a person "check your inbox" has to look at it
 * (`wasSent()` in ./outcome) rather than assume.
 *
 * When the provider is not configured, no token is minted at all. A token
 * that can never reach anyone is not an audit trail; it is noise in the
 * "requested vs. clicked" figures on /admin/email, which exist precisely to
 * show whether verification emails are getting through.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  displayName: string,
): Promise<SendEmailResult> {
  const config = getEmailConfig();
  if (config.missing.length > 0) {
    const error = describeMissingEmailConfig(config.missing);
    // eslint-disable-next-line no-console
    console.error(`[email] ${error}; no verification email for user ${userId}`);
    return { ok: true, skipped: true, error };
  }

  try {
    const plain = generateToken();
    const token = hashToken(plain);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await prisma.verificationToken.create({
      data: { userId, token, expiresAt },
    });
    const verifyUrl = `${baseUrl()}/auth/verify?token=${plain}`;
    return await sendEmail({
      to: email,
      subject: "Verify your PEBL FishSpotter account",
      react: VerificationEmail({ displayName, verifyUrl }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendVerificationEmail failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
