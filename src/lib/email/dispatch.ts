/**
 * Higher-level email dispatchers — these own the token creation + the
 * outbound send so the calling code doesn't have to duplicate the
 * token / hash / URL plumbing every time.
 */

import { VerificationEmail } from "@/lib/email/templates/VerificationEmail";
import { sendEmail } from "@/lib/email/send";
import {
  VERIFICATION_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app").replace(/\/$/, "");
}

/**
 * Generate a verification token, persist its hash, send the email
 * (or no-op when Resend isn't configured). Never throws — the caller's
 * own transaction must not be blocked by email infrastructure.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  displayName: string,
): Promise<void> {
  try {
    const plain = generateToken();
    const token = hashToken(plain);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await prisma.verificationToken.create({
      data: { userId, token, expiresAt },
    });
    const verifyUrl = `${baseUrl()}/auth/verify?token=${plain}`;
    await sendEmail({
      to: email,
      subject: "Verify your PEBL FishSpotter account",
      react: VerificationEmail({ displayName, verifyUrl }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendVerificationEmail failed", err);
  }
}
