/**
 * GET /api/cron/streak-nudge — daily streak-protection cron (S3-17).
 *
 * Runs 09:00 UTC daily. For each opted-in user with a streak ≥ 3
 * days AND no answer in the last 20 hours AND no nudge in the last
 * 6 days, sends a single short email and writes lastStreakNudgeAt.
 */

import { NextResponse } from "next/server";
import { computeStreakFromAnswers } from "@/lib/streak";
import { StreakNudgeEmail } from "@/lib/email/templates/StreakNudgeEmail";
import { digestUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PER_RUN_CAP = 200;
const QUIET_HOURS = 20;
const COOLDOWN_DAYS = 6;
const MIN_STREAK = 3;

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
  const now = new Date();
  const quietWindow = new Date(now.getTime() - QUIET_HOURS * 60 * 60 * 1000);
  const cooldown = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      digestOptIn: true,
      emailVerified: { not: null },
      OR: [{ lastStreakNudgeAt: null }, { lastStreakNudgeAt: { lt: cooldown } }],
    },
    select: { id: true, email: true, displayName: true, name: true },
    take: PER_RUN_CAP,
  });

  let sent = 0;
  let skipped = 0;
  for (const u of candidates) {
    const answers = await prisma.answer.findMany({
      where: { userId: u.id },
      select: { createdAt: true },
    });
    const streak = computeStreakFromAnswers(answers).currentStreak;
    if (streak < MIN_STREAK) {
      skipped++;
      continue;
    }
    const recent = answers.some((a) => a.createdAt > quietWindow);
    if (recent) {
      skipped++;
      continue;
    }
    try {
      await sendEmail({
        to: u.email,
        subject: `Your ${streak}-day streak is on the line`,
        react: StreakNudgeEmail({
          displayName: u.displayName ?? u.name ?? "Spotter",
          currentStreak: streak,
          feedUrl: `${base}/feed`,
          unsubscribeUrl: digestUnsubscribeUrl(u.id, base),
        }),
      });
      await prisma.user.update({
        where: { id: u.id },
        data: { lastStreakNudgeAt: now },
      });
      sent++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cron/streak-nudge] failed", u.id, err);
    }
  }
  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    skipped,
  });
}
