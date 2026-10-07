"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdminUser, requireAdminSession } from "@/lib/admin";
import { loadPrizeWinnerRows, markPrizeFulfilled } from "@/lib/prize-desk";

export type FulfilResult = {
  /** ISO stamp when the guide was marked posted, or null once undone. */
  fulfilledAt: string | null;
  fulfilledBy: string | null;
};

/**
 * Mark a spotter's Seasearch guide posted (or undo it).
 *
 * Fulfilment is manual and off-platform, this only records that a human put a
 * book in the post, so a two-person team doesn't send it twice. It never
 * touches Pebbles, the claim itself, or the spotter's rank; un-marking is
 * always available because the only thing it can be is a mis-click.
 *
 * Since 7 Oct 2026 this also works for a spotter who reached the target but
 * never pressed Claim, since staff now post on reaching it. It refuses anyone
 * PEBL may not write to (a guest, a child without a parent's OK, a spotter
 * whose age we don't know): the same rule the desk shows.
 *
 * Admin-gated like every other action under /admin.
 */
export async function setPrizeFulfilled(
  userId: string,
  posted: boolean,
): Promise<FulfilResult> {
  const { email } = await requireAdminSession();

  if (posted) {
    const rows = await loadPrizeWinnerRows(prisma, new Date());
    const row = rows.find((r) => r.userId === userId);
    // PEBL staff can't win the prize (see /prize-rules).
    if (!row || (!row.claimedAt && (row.status !== "reached-unclaimed" || isAdminUser(row)))) {
      throw new Error("This spotter can't be sent the guide yet.");
    }
  }

  const updated = await markPrizeFulfilled(prisma, userId, posted, email);

  revalidatePath("/admin/prizes");

  return {
    fulfilledAt: updated.fulfilledAt?.toISOString() ?? null,
    fulfilledBy: updated.fulfilledBy,
  };
}
