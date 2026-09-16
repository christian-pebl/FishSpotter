/**
 * Higher-level email dispatchers, these own the token creation + the
 * outbound send so the calling code doesn't have to duplicate the
 * token / hash / URL plumbing every time.
 */

import { SITE_URL } from "@/lib/site-url";
import { VerificationEmail } from "@/lib/email/templates/VerificationEmail";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import { sendEmail } from "@/lib/email/send";
import { describeMissingEmailConfig, getEmailConfig } from "@/lib/email/client";
import type { SendEmailResult } from "@/lib/email/outcome";
import { isAdminEmail } from "@/lib/admin-email";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";

function baseUrl(): string {
  return SITE_URL;
}

/** Optional overrides, used by the catch-up send on /admin/email. */
export interface LinkEmailOptions {
  /** How long the link lives. Defaults to the flow's normal TTL. */
  ttlMs?: number;
  /** The same lifetime in words, for the email's footer. Pass it with ttlMs. */
  expiresIn?: string;
  /** An extra paragraph explaining why this email is arriving. */
  intro?: string;
  subject?: string;
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
  options: LinkEmailOptions = {},
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
    const expiresAt = new Date(Date.now() + (options.ttlMs ?? VERIFICATION_TOKEN_TTL_MS));
    await prisma.verificationToken.create({
      data: { userId, token, expiresAt },
    });
    const verifyUrl = `${baseUrl()}/auth/verify?token=${plain}`;
    return await sendEmail({
      to: email,
      subject: options.subject ?? "Verify your PEBL FishSpotter account",
      react: VerificationEmail({
        displayName,
        verifyUrl,
        intro: options.intro,
        expiresIn: options.expiresIn,
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendVerificationEmail failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mail a one-time link to set a first password, for an account that has an
 * email but has never had a password (a guest who saved their progress).
 * Same never-throws, report-the-outcome contract as sendVerificationEmail,
 * and the same rule that nothing is minted when the provider is unconfigured.
 *
 * The token is an ordinary PasswordResetToken, consumed by POST
 * /api/auth/reset, which also confirms the address (not on the admin domain).
 */
export async function sendAccountSetupEmail(
  userId: string,
  email: string,
  displayName: string,
  options: LinkEmailOptions = {},
): Promise<SendEmailResult> {
  const config = getEmailConfig();
  if (config.missing.length > 0) {
    const error = describeMissingEmailConfig(config.missing);
    // eslint-disable-next-line no-console
    console.error(`[email] ${error}; no account setup email for user ${userId}`);
    return { ok: true, skipped: true, error };
  }

  try {
    const plain = generateToken();
    const token = hashToken(plain);
    const expiresAt = new Date(Date.now() + (options.ttlMs ?? PASSWORD_RESET_TOKEN_TTL_MS));
    await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
    const resetUrl = `${baseUrl()}/auth/reset/${plain}`;
    return await sendEmail({
      to: email,
      subject: options.subject ?? "Finish setting up your PEBL FishSpotter account",
      react: PasswordResetEmail({
        displayName,
        resetUrl,
        variant: "setup",
        intro: options.intro,
        expiresIn: options.expiresIn,
        confirmsEmail: !isAdminEmail(email),
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendAccountSetupEmail failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
