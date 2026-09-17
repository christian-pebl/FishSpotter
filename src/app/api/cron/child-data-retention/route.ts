import { NextResponse } from "next/server";
import { isAuthorisedCron } from "@/lib/cron-auth";
import {
  CONFIRMATION_MANAGE_TTL_MS,
  createManageToken,
  findDueConfirmations,
  markConfirmationSent,
  purgeChildData,
} from "@/lib/parental-consent";
import { sendParentConsentConfirmed } from "@/lib/email/parent-dispatch";
import { sendOutcome, wasSent } from "@/lib/email/outcome";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/child-data-retention, daily at 05:00 UTC.
 *
 * Two jobs from src/lib/parental-consent.ts:
 *
 * 1. The confirmation email for every parental consent granted at least a day
 *    ago (the "plus" of COPPA's email-plus method, which the FTC describes as
 *    sent after a reasonable delay). It repeats the notice and links to the
 *    parent page, where consent can be withdrawn. A send that does not go out
 *    is left unmarked and tried again the next day.
 *
 * 2. The children's data retention rules published in the privacy policy
 *    (src/data/legal/privacy-policy.md, "Children"):
 *    - a parent request unanswered when its link expires is deleted, with the
 *      parent's address;
 *    - expired parent links are deleted;
 *    - an under-13 account idle for a year is deleted.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();

  let confirmationsSent = 0;
  let confirmationsFailed = 0;
  for (const due of await findDueConfirmations(prisma, now)) {
    const manageToken = await createManageToken(
      prisma,
      due.parentEmail,
      now,
      CONFIRMATION_MANAGE_TTL_MS,
    );
    if (!manageToken) continue;
    const delivery = await sendParentConsentConfirmed({
      to: due.parentEmail,
      childName: due.childName,
      purpose: due.purpose,
      manageToken,
      grantedAt: due.grantedAt,
    });
    if (wasSent(delivery)) {
      await markConfirmationSent(prisma, due.id, now);
      confirmationsSent++;
    } else {
      confirmationsFailed++;
      // eslint-disable-next-line no-console
      console.error("[cron/child-data-retention] confirmation not sent", {
        consentId: due.id,
        outcome: sendOutcome(delivery),
      });
    }
  }

  // Purge after sending, so a manage link minted above is not swept up by
  // the expired-token rule in the same run (it is days from expiry anyway).
  const purge = await purgeChildData(prisma, now);
  const result = { confirmationsSent, confirmationsFailed, ...purge };
  // eslint-disable-next-line no-console
  console.log("[cron/child-data-retention]", JSON.stringify(result));
  return NextResponse.json({ ok: true, ...result });
}
