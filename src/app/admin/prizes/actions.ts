"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { markPrizeFulfilled } from "@/lib/prize-desk";

export type FulfilResult = {
  /** ISO stamp when the guide was marked posted, or null once undone. */
  fulfilledAt: string | null;
  fulfilledBy: string | null;
};

/**
 * Mark a spotter's Seasearch guide posted (or undo it).
 *
 * Fulfilment is manual and off-platform — this only records that a human put a
 * book in the post, so a two-person team doesn't send it twice. It never
 * touches Pebbles, the claim itself, or the spotter's rank; un-marking is
 * always available because the only thing it can be is a mis-click.
 *
 * Admin-gated like every other action under /admin.
 */
export async function setPrizeFulfilled(
  userId: string,
  posted: boolean,
): Promise<FulfilResult> {
  const { email } = await requireAdminSession();

  const updated = await markPrizeFulfilled(prisma, userId, posted, email);

  revalidatePath("/admin/prizes");

  return {
    fulfilledAt: updated.fulfilledAt?.toISOString() ?? null,
    fulfilledBy: updated.fulfilledBy,
  };
}
