import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { checkCommentRateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS, shouldAutoHide } from "@/lib/comments";
import { notifyStaffOfComment } from "@/lib/email/comment-notify";

/**
 * Report a comment.
 *
 * An accessible reporting route is a specific Online Safety Act duty for a
 * user-to-user service, not optional polish — it is the mechanism that turns
 * moderation from "we watch it" into "anyone can flag it and we act".
 *
 * One report per person per comment (enforced by the @@unique on
 * (commentId, userId)), so a single motivated user cannot inflate a count and
 * hide something they merely disagree with. At AUTO_HIDE_REPORTS distinct
 * reporters the comment auto-hides pending staff review; hiding is reversible,
 * so a false positive costs a few hours of visibility while a slow takedown
 * costs a great deal more.
 */
export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkCommentRateLimit(userId))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;

  let parsed;
  try {
    parsed = ReportSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      body: true,
      reason: true,
      suggestedName: true,
      snippet: { select: { externalId: true } },
      user: { select: { displayName: true, name: true } },
    },
  });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  // Reporting your own comment is meaningless and would let an author
  // self-inflate toward the auto-hide threshold.
  if (comment.userId === userId) {
    return NextResponse.json({ error: "You can't report your own comment." }, { status: 400 });
  }

  // Idempotent: re-reporting is a no-op rather than an error, so a double-tap
  // on a phone doesn't surface a scary message.
  await prisma.commentReport.upsert({
    where: { commentId_userId: { commentId: id, userId } },
    create: { commentId: id, userId, reason: parsed.reason },
    update: { reason: parsed.reason },
  });

  // Recompute from the relation rather than incrementing, so the count can
  // never drift from the actual number of distinct reporters.
  const reportCount = await prisma.commentReport.count({ where: { commentId: id } });

  await prisma.comment.update({
    where: { id },
    data: {
      reportCount,
      ...(shouldAutoHide(reportCount)
        ? { hiddenAt: new Date(), hiddenReason: `auto: ${reportCount} reports` }
        : {}),
      // Surface it for staff review even below the auto-hide threshold.
      status: "new",
    },
  });

  // Page staff on the FIRST report only. Subsequent reports on the same comment
  // add to the count (and can trip the auto-hide) without re-notifying, so a
  // pile-on can't spam the inbox.
  if (reportCount === 1) {
    await notifyStaffOfComment(prisma, {
      authorName:
        comment.user.displayName ?? comment.user.name ?? `Spotter ${comment.userId.slice(0, 6)}`,
      reason: comment.reason,
      body: comment.body,
      suggestedName: comment.suggestedName,
      snippetLabel: comment.snippet.externalId,
      theirAnswer: null,
      isReport: true,
      reportCount,
    });
  }

  return new NextResponse(null, { status: 204 });
}
