/**
 * Taking a possible child's contact details off an account, in one place.
 *
 * Two callers:
 *   - POST /api/account/age, when an account answers "under 13";
 *   - the child-data-retention cron, when a school-address account reaches
 *     the removal date it was told about (src/lib/age-notice.ts).
 *
 * What goes: the email address (replaced by an unreachable placeholder), the
 * password, pending email links, social sign-in links and optional-email
 * settings. With `asChild`, also any comments the account wrote (free text
 * can carry a name or address) and its usage events (a child under 13 cannot
 * consent to analytics). What stays: the answers and Pebbles, so the player
 * loses no progress, and the session on their own device.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { placeholderEmail } from "@/lib/age";

type Tx = Pick<
  PrismaClient,
  "verificationToken" | "passwordResetToken" | "account" | "comment" | "event" | "user"
>;

export function stripContactOps(
  prisma: Tx,
  userId: string,
  opts: { asChild: boolean; data?: Prisma.UserUpdateInput },
): Prisma.PrismaPromise<unknown>[] {
  return [
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    ...(opts.asChild
      ? [
          prisma.comment.deleteMany({ where: { userId } }),
          prisma.event.deleteMany({ where: { userId } }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: placeholderEmail(globalThis.crypto.randomUUID()),
        emailVerified: null,
        passwordHash: null,
        isGuest: true,
        digestOptIn: false,
        newClipsOptIn: false,
        ...opts.data,
      },
      select: { id: true },
    }),
  ];
}
