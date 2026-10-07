/**
 * GET /api/cron/prize-alerts. Tells PEBL staff who has reached the Pebble
 * target and should be sent the Seasearch guide (7 Oct 2026).
 *
 * Runs daily per vercel.json, after consensus-rescore, because the consensus
 * payout can carry a spotter over the target retroactively. Authorization:
 * Bearer CRON_SECRET, same as every other cron.
 *
 * Reads the same rows as the prize desk (loadPrizeWinnerRows), decides who is
 * due with prizeAlertsDue (src/lib/prize-alerts.ts), sends one email to every
 * verified admin, and only then stamps the spotters, so a failed send is
 * retried on the next run. Sends nothing when nobody new has crossed.
 */

import { NextResponse } from "next/server";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { loadPrizeWinnerRows } from "@/lib/prize-desk";
import { PRIZE_TARGET_PEBBLES } from "@/lib/prize";
import {
  SEND_CONTACT_NOTE,
  WAITING_NOTE,
  prizeAlertsDue,
  stampsAfterAlert,
  type PrizeAlert,
} from "@/lib/prize-alerts";
import { notifyStaffOfPrizeMilestones } from "@/lib/email/prize-notify";
import type { PrizeMilestoneEntry } from "@/lib/email/templates/PrizeMilestoneStaffEmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function entry(a: PrizeAlert): PrizeMilestoneEntry {
  const notes = a.kind === "send" ? SEND_CONTACT_NOTE : WAITING_NOTE;
  return {
    spotter: a.row.spotter,
    pebbles: a.row.pebbles,
    note: notes[a.row.contact] ?? "",
    // Only worth flagging on someone we can actually send to.
    flags: a.kind === "send" && !a.row.eligible ? a.row.eligibilityReasons : [],
  };
}

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const rows = await loadPrizeWinnerRows(prisma, now);
  if (rows.length === 0) return NextResponse.json({ ok: true, due: 0, sent: 0 });

  const stampRows = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, prizeAlertedAt: true, prizeSendableAlertedAt: true },
  });
  const stamps = new Map(stampRows.map((s) => [s.id, s]));

  const due = prizeAlertsDue(rows, stamps);
  if (due.length === 0) return NextResponse.json({ ok: true, due: 0, sent: 0 });

  const sent = await notifyStaffOfPrizeMilestones(prisma, {
    send: due.filter((a) => a.kind === "send").map(entry),
    waiting: due.filter((a) => a.kind === "waiting").map(entry),
    target: PRIZE_TARGET_PEBBLES,
  });

  if (sent === 0) {
    log.error("prize-alerts: no admin inbox reached, will retry next run", { due: due.length });
    return NextResponse.json({ ok: false, due: due.length, sent }, { status: 502 });
  }

  for (const a of due) {
    await prisma.user.update({
      where: { id: a.row.userId },
      data: stampsAfterAlert(a, stamps.get(a.row.userId), now),
      select: { id: true },
    });
  }

  log.info("prize-alerts: staff told", { due: due.length, sent });
  return NextResponse.json({ ok: true, due: due.length, sent });
}
