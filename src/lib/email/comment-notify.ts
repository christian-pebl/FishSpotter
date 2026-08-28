/**
 * Instant staff notification for clip comments.
 *
 * Two deliberate design constraints:
 *
 * 1. TIMING. This repo is Next 14.2.35 with no @vercel/functions, so there is no
 *    after() and no waitUntil. A fire-and-forget promise is unreliable: the
 *    serverless instance can freeze the moment the response is sent, and the
 *    email silently never goes. So the send is AWAITED, wrapped in a short
 *    timeout. SendGrid is typically 200-300ms and posting a comment is a
 *    deliberate one-off action, not a hot loop, so the cost is acceptable and
 *    it needs no new dependency. If the latency ever shows, the upgrade is to
 *    add @vercel/functions and switch to waitUntil.
 *
 * 2. FLOOD CAP. Instant notification is right at launch volume but would turn a
 *    spam run, or simply a busy afternoon, into a pager. Each recipient is
 *    throttled via the existing rate limiter; over the cap the EMAIL is skipped,
 *    never the comment, which is still sitting in /admin/comments.
 *
 * Never throws: an email problem must not fail a spotter's post.
 */

import { NewCommentEmail } from "@/lib/email/templates/NewCommentEmail";
import { sendEmail } from "@/lib/email/send";
import { checkCommentMailRateLimit } from "@/lib/rate-limit";
import { REASON_LABELS, type ReasonCode } from "@/lib/comments";
import { isAdminUser } from "@/lib/admin";
import type { PrismaClient } from "@prisma/client";

const SEND_TIMEOUT_MS = 3000;

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app").replace(/\/$/, "");
}

export interface NotifyDecisionInput {
  /** Is this comment a reply to another comment? */
  isReply: boolean;
  /** Was the parent authored by PEBL staff? Only meaningful when isReply. */
  parentIsPebl: boolean;
  /** Is the author themselves staff? Staff commenting shouldn't page staff. */
  authorIsPebl: boolean;
}

/**
 * Whether a newly created comment should page staff.
 *
 * Top-level comments notify. Replies notify only when they answer a PEBL
 * comment, because ordinary spotter-to-spotter chat would drown the signal
 * within a week and staff would start ignoring the channel, which is worse
 * than not having it.
 */
export function shouldNotify(input: NotifyDecisionInput): boolean {
  if (input.authorIsPebl) return false;
  if (!input.isReply) return true;
  return input.parentIsPebl;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export interface NotifyPayload {
  authorName: string;
  reason: string;
  body: string;
  suggestedName: string | null;
  snippetLabel: string;
  theirAnswer: string | null;
  isReport?: boolean;
  reportCount?: number;
}

/**
 * Email every verified @pebl-cic.co.uk user about a comment. Recipients are
 * resolved with the same rule isAdminUser() enforces, so the definition of
 * "staff" lives in exactly one place.
 */
export async function notifyStaffOfComment(
  prisma: PrismaClient,
  payload: NotifyPayload,
): Promise<{ sent: number; throttled: number }> {
  let sent = 0;
  let throttled = 0;

  try {
    const candidates = await prisma.user.findMany({
      where: {
        email: { endsWith: "@pebl-cic.co.uk" },
        emailVerified: { not: null },
      },
      select: { email: true, emailVerified: true },
    });

    const recipients = candidates
      .filter((u) => isAdminUser(u))
      .map((u) => u.email)
      .filter((e): e is string => !!e);

    if (recipients.length === 0) return { sent: 0, throttled: 0 };

    const reasonLabel =
      REASON_LABELS[payload.reason as ReasonCode] ?? payload.reason ?? "comment";

    for (const to of recipients) {
      if (!(await checkCommentMailRateLimit(to))) {
        throttled++;
        continue;
      }
      const result = await withTimeout(
        sendEmail({
          to,
          subject: payload.isReport
            ? `FishSpotter: comment reported (${payload.reportCount ?? 1})`
            : `FishSpotter: new comment (${reasonLabel.toLowerCase()})`,
          react: NewCommentEmail({
            authorName: payload.authorName,
            reasonLabel,
            body: payload.body,
            suggestedName: payload.suggestedName,
            snippetLabel: payload.snippetLabel,
            theirAnswer: payload.theirAnswer,
            inboxUrl: `${baseUrl()}/admin/comments`,
            isReport: !!payload.isReport,
            reportCount: payload.reportCount ?? 0,
          }),
        }),
        SEND_TIMEOUT_MS,
      );
      if (result?.ok) sent++;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] notifyStaffOfComment failed", err);
  }

  return { sent, throttled };
}
