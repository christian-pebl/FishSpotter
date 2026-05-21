/**
 * GET /api/cron/digest — weekly digest cron (S3-16).
 *
 * Runs Mon 08:00 UTC per vercel.json. Authorization: Bearer CRON_SECRET
 * (same pattern as the existing biodiversity crons). For each user
 * with digestOptIn = true AND emailVerified IS NOT NULL, computes
 * a small stats payload and sends a digest. Cap: 200 per invocation
 * to stay inside Vercel's 60s timeout.
 */

import { NextResponse } from "next/server";
import { computeStreakFromAnswers } from "@/lib/streak";
import { WeeklyDigestEmail } from "@/lib/email/templates/WeeklyDigestEmail";
import { digestUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN_CAP = 200;

function unauthorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const got = req.headers.get("authorization");
  return got !== `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (unauthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = (process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app").replace(/\/$/, "");
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const newSnippetCount = await prisma.snippet.count({
    where: { createdAt: { gte: weekAgo } },
  });

  const recipients = await prisma.user.findMany({
    where: {
      digestOptIn: true,
      emailVerified: { not: null },
    },
    select: { id: true, email: true, displayName: true, name: true },
    take: PER_RUN_CAP,
  });

  let sent = 0;
  let failed = 0;
  for (const u of recipients) {
    try {
      const answers = await prisma.answer.findMany({
        where: { userId: u.id },
        select: { createdAt: true, isCorrect: true },
      });
      const weekly = answers.filter((a) => a.createdAt >= weekAgo);
      const correct = weekly.filter((a) => a.isCorrect).length;
      const streak = computeStreakFromAnswers(answers).currentStreak;
      await sendEmail({
        to: u.email,
        subject: "Your PEBL FishSpotter week",
        react: WeeklyDigestEmail({
          displayName: u.displayName ?? u.name ?? "Spotter",
          weeklyAnswers: weekly.length,
          weeklyCorrect: correct,
          currentStreak: streak,
          newSnippetCount,
          feedUrl: `${base}/feed`,
          unsubscribeUrl: digestUnsubscribeUrl(u.id, base),
        }),
      });
      sent++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.error("[cron/digest] failed", u.id, err);
    }
  }
  return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed });
}
