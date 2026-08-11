import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadPrizeWinnerRows } from "@/lib/prize-desk";
import {
  PRIZE_NAME,
  PRIZE_STATUS_LABEL,
  PRIZE_TARGET_PEBBLES,
  type PrizeStatus,
  type PrizeWinnerRow,
} from "@/lib/prize";
import { CopyEmailButton, PostedToggle } from "./PrizeRowActions";

// The fulfilment desk, and now the ONLY prize workflow: spotters have no claim
// button (removed 11 Aug 2026), so nothing anywhere tells PEBL a winner exists.
// This page is the queue. Read-mostly: the single write is "mark posted",
// which also creates the fulfilment record on the spot.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Prizes · FishSpotter admin" };

const STATUS_PILL: Record<PrizeStatus, string> = {
  "to-post": "bg-teal-600 text-white",
  unreachable: "bg-navy-100 text-navy-700",
  posted: "bg-navy-100 text-navy-500",
};

function dateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

/** The contact cell: a real address, or why there isn't one. */
function Contact({ row }: { row: PrizeWinnerRow }) {
  if (row.contact === "guest") {
    return (
      <span className="text-navy-500">
        Guest account — no real address.{" "}
        <span className="text-navy-400">Nudge them to save their finds in-app.</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {/* The table scrolls horizontally rather than breaking an address
          mid-word: a half-wrapped email is exactly the thing someone
          mis-transcribes when posting a book. */}
      <span className="whitespace-nowrap text-navy-900">{row.contactEmail}</span>
      {row.contact === "unverified" ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-pending px-2 py-0.5 text-[10px] font-semibold text-pending-ink">
          unverified
        </span>
      ) : null}
      <CopyEmailButton email={row.contactEmail!} />
    </span>
  );
}

export default async function AdminPrizesPage() {
  const rows = await loadPrizeWinnerRows(prisma, new Date());
  const count = (s: PrizeStatus) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <h1 className="font-brand text-xl font-semibold text-navy-900">Prize fulfilment</h1>
      <p className="mt-1 text-sm text-navy-600">
        Spotters at or over {PRIZE_TARGET_PEBBLES.toLocaleString()} lifetime Pebbles. There is
        no claim button, so nothing notifies PEBL when someone crosses the line. Email each
        winner for a postal address, send the {PRIZE_NAME}, then mark it posted here so it
        cannot be sent twice.
      </p>
      <p className="mt-2 text-[12px] text-navy-500">
        {count("to-post")} to post · {count("unreachable")} unreachable ·{" "}
        {count("posted")} posted
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-card border border-navy-200/60 bg-white px-4 py-6 text-sm text-navy-600">
          No spotter has reached {PRIZE_TARGET_PEBBLES.toLocaleString()} Pebbles yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-navy-200/60 bg-white">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-navy-200/60 text-[10px] font-semibold uppercase tracking-wide text-navy-500">
                <th className="px-3 py-2">Spotter</th>
                <th className="px-3 py-2">Pebbles</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Posted</th>
                <th className="px-3 py-2">Trust gate</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-200/60">
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-3 py-2 font-medium text-navy-900">{r.spotter}</td>
                  <td className="px-3 py-2 tabular-nums text-navy-900">
                    {r.pebbles.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Contact row={r} />
                  </td>
                  <td className="px-3 py-2 text-navy-500">
                    {r.fulfilledAt ? (
                      <>
                        {dateOnly(r.fulfilledAt)}
                        {r.fulfilledBy ? (
                          <span className="block text-[10px] text-navy-400">
                            by {r.fulfilledBy}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-navy-500">
                    {r.eligible ? (
                      "passes"
                    ) : (
                      // ADVISORY ONLY since the claim gate was removed: this
                      // never blocks anything, it just flags a total worth a
                      // second look before PEBL spends money on a book (the
                      // classic shape being 2,000 Pebbles inside a single
                      // three-day burst).
                      <span title={r.eligibilityReasons.join(", ")}>
                        fails: {r.eligibilityReasons.join(", ") || "unknown"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL[r.status]}`}
                    >
                      {PRIZE_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {/* Available for every reachable winner, not just those
                        holding a claim row: with no claim button, a winner
                        normally has no row until this toggle creates one.
                        Gating on claimedAt made the desk's only write
                        impossible for exactly the people it serves. */}
                    {r.contact === "guest" ? (
                      <span className="text-navy-400">—</span>
                    ) : (
                      <PostedToggle
                        userId={r.userId}
                        spotter={r.spotter}
                        fulfilled={!!r.fulfilledAt}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
