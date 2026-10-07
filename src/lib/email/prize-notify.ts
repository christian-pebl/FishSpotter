/**
 * Tell PEBL staff about prize winners: a claim (POST /api/prize/claim), or a
 * spotter crossing the Pebble target (the prize-alerts cron).
 *
 * Same shape as comment-notify.ts: recipients are every verified admin
 * address, the send is awaited under a short timeout because a serverless
 * function can freeze once it has answered, and it never throws, so an email
 * problem cannot fail a spotter's claim. The claim is on the desk either way.
 */

import type { PrismaClient } from "@prisma/client";
import { SITE_URL } from "@/lib/site-url";
import { isAdminUser } from "@/lib/admin";
import { ADMIN_EMAIL_SUFFIX } from "@/lib/admin-email";
import { sendEmail } from "@/lib/email/send";
import { PrizeClaimStaffEmail } from "@/lib/email/templates/PrizeClaimStaffEmail";
import {
  PrizeMilestoneStaffEmail,
  type PrizeMilestoneEntry,
} from "@/lib/email/templates/PrizeMilestoneStaffEmail";

const SEND_TIMEOUT_MS = 3000;

async function staffRecipients(prisma: PrismaClient): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: { email: { endsWith: ADMIN_EMAIL_SUFFIX }, emailVerified: { not: null } },
    select: { email: true, emailVerified: true },
  });
  return candidates.filter((u) => isAdminUser(u)).map((u) => u.email);
}

export async function notifyStaffOfPrizeClaim(
  prisma: PrismaClient,
  claim: { spotter: string; viaParent: boolean },
): Promise<number> {
  let sent = 0;
  try {
    const recipients = await staffRecipients(prisma);
    for (const to of recipients) {
      const result = await Promise.race([
        sendEmail({
          to,
          subject: `FishSpotter: prize claimed by ${claim.spotter}`,
          react: PrizeClaimStaffEmail({
            spotter: claim.spotter,
            viaParent: claim.viaParent,
            deskUrl: `${SITE_URL}/admin/prizes`,
          }),
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SEND_TIMEOUT_MS)),
      ]);
      if (result?.ok) sent++;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] notifyStaffOfPrizeClaim failed", err);
  }
  return sent;
}

/**
 * "Send a prize to these people": the prize-alerts cron's email. Returns how
 * many admin inboxes it reached; the cron only stamps the spotters as alerted
 * when that is at least one, so a failed send is retried the next day.
 */
export async function notifyStaffOfPrizeMilestones(
  prisma: PrismaClient,
  alert: { send: PrizeMilestoneEntry[]; waiting: PrizeMilestoneEntry[]; target: number },
): Promise<number> {
  let sent = 0;
  try {
    const recipients = await staffRecipients(prisma);
    const subject =
      alert.send.length > 0
        ? `FishSpotter: send a prize to ${alert.send.map((e) => e.spotter).join(", ")}`
        : `FishSpotter: ${alert.waiting.length} more reached ${alert.target.toLocaleString("en-GB")} Pebbles`;
    for (const to of recipients) {
      const result = await Promise.race([
        sendEmail({
          to,
          subject,
          react: PrizeMilestoneStaffEmail({ ...alert, deskUrl: `${SITE_URL}/admin/prizes` }),
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SEND_TIMEOUT_MS)),
      ]);
      if (result?.ok) sent++;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] notifyStaffOfPrizeMilestones failed", err);
  }
  return sent;
}
