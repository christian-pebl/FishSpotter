"use server";

import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { sendOutcome, type SendOutcome } from "@/lib/email/outcome";
import { AgePolicyNoticeEmail } from "@/lib/email/templates/AgePolicyNoticeEmail";
import { SITE_URL } from "@/lib/site-url";
import {
  AGE_NOTICE_SUBJECT,
  decideAgeNotice,
  formatNoticeDate,
  markAgeNoticeSent,
  readAgeNoticeTarget,
  removalDateFor,
} from "@/lib/age-notice";

export interface NoticePreviewResult {
  to: string;
  outcome: SendOutcome;
  error?: string;
}

export interface NoticeSendResult {
  userId: string;
  outcome: "sent" | "skipped" | "failed";
  /** Why it was skipped, the provider's reason for refusing it, or the removal date. */
  detail?: string;
}

function noticeEmail(displayName: string, sentAt: Date) {
  return AgePolicyNoticeEmail({
    displayName,
    removalOn: formatNoticeDate(removalDateFor(sentAt)),
    appUrl: `${SITE_URL}/feed`,
    parentUrl: `${SITE_URL}/parent`,
    privacyUrl: `${SITE_URL}/privacy#children`,
  });
}

/** The notice exactly as a spotter would get it, sent to the signed-in admin. */
export async function sendAgeNoticePreview(): Promise<NoticePreviewResult> {
  const { email } = await requireAdminSession();
  const result = await sendEmail({
    to: email,
    subject: `[Preview] ${AGE_NOTICE_SUBJECT}`,
    react: noticeEmail("Spotter", new Date()),
  });
  return { to: email, outcome: sendOutcome(result), error: result.error };
}

/**
 * Send the notice to ONE account (src/lib/age-notice.ts). The page calls this
 * once per chosen account. Everything is re-read and re-decided here, and the
 * account is stamped only once the email has really gone, so the removal date
 * the cron applies is the date the email promised.
 */
export async function sendAgeNotice(userId: string): Promise<NoticeSendResult> {
  await requireAdminSession();
  const target = await readAgeNoticeTarget(prisma, userId);
  const decision = decideAgeNotice(target);
  if (!decision.send || !target) {
    return { userId, outcome: "skipped", detail: decision.send ? "account not found" : decision.reason };
  }

  const now = new Date();
  const name = target.displayName?.trim() || target.name?.trim() || "Spotter";
  const result = await sendEmail({
    to: target.email,
    subject: AGE_NOTICE_SUBJECT,
    react: noticeEmail(name, now),
  });
  const outcome = sendOutcome(result);
  if (outcome === "sent") {
    await markAgeNoticeSent(prisma, userId, now);
    return { userId, outcome: "sent", detail: `removal on ${formatNoticeDate(removalDateFor(now))}` };
  }

  // eslint-disable-next-line no-console
  console.error("[admin/children] age notice not delivered", { userId, outcome, error: result.error });
  return {
    userId,
    outcome: "failed",
    detail:
      outcome === "not-configured"
        ? "email is not configured on this deployment"
        : result.error ?? "the provider refused it",
  };
}
