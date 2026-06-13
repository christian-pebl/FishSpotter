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
import { isAuthorisedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN_CAP = 200;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
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
      log.error("digest send failed", { context: "cron/digest", userId: u.id, err });
    }
  }

  // Surface a partial or total failure as HTTP 500 so Vercel cron-failure
  // alerting fires; an all-good run (or a run with no recipients) stays 200.
  const degraded = failed > 0 || (sent === 0 && recipients.length > 0);
  if (degraded) {
    log.error("digest cron degraded", {
      context: "cron/digest",
      recipients: recipients.length,
      sent,
      failed,
    });
    return NextResponse.json(
      { ok: false, recipients: recipients.length, sent, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed });
}
