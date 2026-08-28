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

// The fulfilment desk. Claiming the guide only records that a spotter asked
// for it (POST /api/prize/claim writes a zero-cost PebblePurchase and returns);
// nothing emails PEBL, so without this page a claim sits unnoticed until
// someone thinks to run SQL. Read-mostly: the single write is "mark posted".
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Prizes · FishSpotter admin" };

const STATUS_PILL: Record<PrizeStatus, string> = {
  "to-post": "bg-teal-600 text-white",
  "reached-unclaimed": "bg-pending text-pending-ink",
  unreachable: "bg-navy-100 text-navy-700",
  posted: "bg-navy-100 text-navy-500",
};

function dateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}

/** The contact cell: a real address, or why there isn't one. */
function Contact({ row }: { row: PrizeWinnerRow }) {
  if (row.contact === "guest") {
    return (
      <span className="text-navy-500">
        Guest account, no real address.{" "}
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
        Spotters at or over {PRIZE_TARGET_PEBBLES.toLocaleString()} lifetime Pebbles. Claiming
        only records that someone asked for the {PRIZE_NAME}, posting it is manual, and
        nothing emails PEBL when a claim lands, so this page is the queue.
      </p>
      <p className="mt-2 text-[12px] text-navy-500">
        {count("to-post")} to post · {count("reached-unclaimed")} not claimed ·{" "}
        {count("unreachable")} unreachable · {count("posted")} posted
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
                <th className="px-3 py-2">Claimed</th>
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
                    {dateOnly(r.claimedAt)}
                    {r.fulfilledAt ? (
                      <span className="block text-[10px] text-navy-400">
                        posted {dateOnly(r.fulfilledAt)}
                        {r.fulfilledBy ? ` by ${r.fulfilledBy}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-navy-500">
                    {r.eligible ? (
                      "passes"
                    ) : (
                      // A claimed row can't have failed the gate (the route
                      // checks it), so a "fails" here means either an unclaimed
                      // spotter who isn't allowed to claim yet, or an account
                      // whose trust has since decayed, worth a look before
                      // posting a book.
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
                    {r.claimedAt ? (
                      <PostedToggle
                        userId={r.userId}
                        spotter={r.spotter}
                        fulfilled={!!r.fulfilledAt}
                      />
                    ) : (
                      <span className="text-navy-400">-</span>
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
