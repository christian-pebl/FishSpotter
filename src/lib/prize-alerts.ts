/**
 * Which prize winners PEBL staff should be told about today.
 *
 * Until 7 Oct 2026 staff heard about a winner only when the spotter pressed
 * Claim (src/lib/email/prize-notify.ts). Nobody was told a spotter had crossed
 * the Pebble target, and the claim gate (five spotting days over fourteen)
 * meant most winners could not press Claim yet. Two spotters sat over 2,000
 * for weeks before anyone noticed on the desk. Christian's rule since then:
 * when someone reaches the target, email the admins to send them a book.
 *
 * The daily prize-alerts cron feeds this the desk rows (loadPrizeWinnerRows,
 * so the desk and the email can never disagree) and each spotter's alert
 * stamps. Pure, so the decision table is unit tested.
 *
 *   send     over the target, not claimed, and someone we may write to:
 *            alerted once.
 *   waiting  over the target, but nobody we may write to yet (a guest with
 *            no real address, an under-18 without a parent's OK, or a spotter
 *            who hasn't told us their age). Alerted once on crossing, then
 *            again as `send` when they become reachable.
 *
 * Claimed rows are skipped: the claim already emailed staff. PEBL's own staff
 * are skipped too, since the prize rules exclude them.
 */

import { isAdminEmail } from "@/lib/admin-email";
import type { PrizeContactState, PrizeWinnerRow } from "@/lib/prize";

export type PrizeAlertKind = "send" | "waiting";

export interface PrizeAlertStamps {
  prizeAlertedAt: Date | null;
  prizeSendableAlertedAt: Date | null;
}

export interface PrizeAlert {
  kind: PrizeAlertKind;
  row: PrizeWinnerRow;
}

/**
 * isAdminUser's rule (src/lib/admin.ts): the staff domain AND a verified
 * address, since a guest can type the domain. Restated here so this module
 * stays pure; admin.ts pulls in the auth config.
 */
function isStaff(row: PrizeWinnerRow): boolean {
  return row.emailVerified !== null && isAdminEmail(row.email);
}

export function prizeAlertsDue(
  rows: readonly PrizeWinnerRow[],
  stamps: ReadonlyMap<string, PrizeAlertStamps>,
): PrizeAlert[] {
  const due: PrizeAlert[] = [];
  for (const row of rows) {
    if (row.claimedAt) continue;
    if (isStaff(row)) continue;
    const s = stamps.get(row.userId);
    if (row.status === "reached-unclaimed" && !s?.prizeSendableAlertedAt) {
      due.push({ kind: "send", row });
    } else if (row.status === "unreachable" && !s?.prizeAlertedAt) {
      due.push({ kind: "waiting", row });
    }
  }
  return due;
}

/** The stamps to write once staff have been told. */
export function stampsAfterAlert(
  alert: PrizeAlert,
  current: PrizeAlertStamps | undefined,
  now: Date,
): PrizeAlertStamps {
  return {
    prizeAlertedAt: current?.prizeAlertedAt ?? now,
    prizeSendableAlertedAt:
      alert.kind === "send" ? now : (current?.prizeSendableAlertedAt ?? null),
  };
}

/** Who to write to, in the staff email. Never the address itself. */
export const SEND_CONTACT_NOTE: Partial<Record<PrizeContactState, string>> = {
  verified: "Email confirmed.",
  unverified: "Email given but never confirmed, so check it is theirs.",
  parent: "Under 18. Write only to the parent or carer shown on the desk.",
};

/** Why a winner can't be written to yet, in the staff email. */
export const WAITING_NOTE: Partial<Record<PrizeContactState, string>> = {
  guest: "Guest account with no email. They have to save their account in the app first.",
  "needs-parent": "Under 18 and no parent or carer has said yes yet. Don't contact them.",
  "age-unknown": "Hasn't told us their age yet. The app asks on their next visit.",
};
