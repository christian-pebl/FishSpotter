"use server";

import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { sendOutcome, type SendOutcome } from "@/lib/email/outcome";
import { sendAccountSetupEmail, sendVerificationEmail } from "@/lib/email/dispatch";
import { TestEmail } from "@/lib/email/templates/TestEmail";
import { VerificationEmail } from "@/lib/email/templates/VerificationEmail";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import {
  CATCH_UP_SETUP_EXPIRES_IN,
  CATCH_UP_SETUP_INTRO,
  CATCH_UP_SETUP_SUBJECT,
  CATCH_UP_SETUP_TTL_MS,
  CATCH_UP_VERIFY_EXPIRES_IN,
  CATCH_UP_VERIFY_INTRO,
  CATCH_UP_VERIFY_SUBJECT,
  CATCH_UP_VERIFY_TTL_MS,
  decideCatchUp,
  readCatchUpTarget,
  type CatchUpKind,
} from "@/lib/email/verification-backlog";
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
 * happened. This is the only way to see Resend's reason for refusing a
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

export interface CatchUpSendResult {
  userId: string;
  outcome: "sent" | "skipped" | "failed";
  /** Which email went, or would have gone. Null when nothing was decided. */
  kind: CatchUpKind | null;
  /** Why it was skipped, or the provider's reason for refusing it. */
  detail?: string;
}

/**
 * The catch-up send for ONE account (src/lib/email/verification-backlog.ts).
 * The page loops over its selection and calls this once per account, so no
 * single request runs long and the provider's two-a-second limit is easy to
 * respect. Everything is re-read and re-decided here: an account confirmed,
 * mailed or turned into a guest since the page loaded is skipped, not mailed.
 */
export async function sendCatchUpEmail(userId: string): Promise<CatchUpSendResult> {
  await requireAdminSession();
  const target = await readCatchUpTarget(prisma, userId);
  const decision = decideCatchUp(target, new Date());
  if (!decision.send || !target) {
    return {
      userId,
      outcome: "skipped",
      kind: null,
      detail: decision.send ? "account not found" : decision.reason,
    };
  }

  const name = target.displayName?.trim() || target.name?.trim() || "Spotter";
  const result =
    decision.kind === "setup"
      ? await sendAccountSetupEmail(target.id, target.email, name, {
          ttlMs: CATCH_UP_SETUP_TTL_MS,
          expiresIn: CATCH_UP_SETUP_EXPIRES_IN,
          intro: CATCH_UP_SETUP_INTRO,
          subject: CATCH_UP_SETUP_SUBJECT,
        })
      : await sendVerificationEmail(target.id, target.email, name, {
          ttlMs: CATCH_UP_VERIFY_TTL_MS,
          expiresIn: CATCH_UP_VERIFY_EXPIRES_IN,
          intro: CATCH_UP_VERIFY_INTRO,
          subject: CATCH_UP_VERIFY_SUBJECT,
        });

  const outcome = sendOutcome(result);
  if (outcome === "sent") return { userId, outcome: "sent", kind: decision.kind };

  // eslint-disable-next-line no-console
  console.error("[admin/email] catch-up email not delivered", {
    userId,
    kind: decision.kind,
    outcome,
    error: result.error,
  });
  return {
    userId,
    outcome: "failed",
    kind: decision.kind,
    detail:
      outcome === "not-configured"
        ? "email is not configured on this deployment"
        : result.error ?? "the provider refused it",
  };
}

/**
 * The catch-up email exactly as a spotter would get it, sent to the signed-in
 * admin. No token is minted: the button points at a link that cannot work, so
 * a preview can never set a password or confirm an address, and it never
 * shows up in the requested-versus-clicked figures.
 */
export async function sendCatchUpPreview(kind: CatchUpKind): Promise<TestSendResult> {
  const { email } = await requireAdminSession();
  const sentAt = new Date().toISOString();
  const deadToken = "0".repeat(64);
  const react =
    kind === "setup"
      ? PasswordResetEmail({
          displayName: "Spotter",
          resetUrl: `${SITE_URL}/auth/reset/${deadToken}`,
          variant: "setup",
          intro: CATCH_UP_SETUP_INTRO,
          expiresIn: CATCH_UP_SETUP_EXPIRES_IN,
        })
      : VerificationEmail({
          displayName: "Spotter",
          verifyUrl: `${SITE_URL}/auth/verify?token=${deadToken}`,
          intro: CATCH_UP_VERIFY_INTRO,
          expiresIn: CATCH_UP_VERIFY_EXPIRES_IN,
        });
  const result = await sendEmail({
    to: email,
    subject: `[Preview] ${kind === "setup" ? CATCH_UP_SETUP_SUBJECT : CATCH_UP_VERIFY_SUBJECT}`,
    react,
  });
  return {
    to: email,
    outcome: sendOutcome(result),
    messageId: result.messageId,
    error: result.error,
    sentAt,
  };
}
