/**
 * Tell PEBL staff a prize was claimed (POST /api/prize/claim).
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

const SEND_TIMEOUT_MS = 3000;

export async function notifyStaffOfPrizeClaim(
  prisma: PrismaClient,
  claim: { spotter: string; viaParent: boolean },
): Promise<number> {
  let sent = 0;
  try {
    const candidates = await prisma.user.findMany({
      where: { email: { endsWith: ADMIN_EMAIL_SUFFIX }, emailVerified: { not: null } },
      select: { email: true, emailVerified: true },
    });
    const recipients = candidates.filter((u) => isAdminUser(u)).map((u) => u.email);
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
