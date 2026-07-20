import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isPrizeEligible } from "@/lib/trust";

// Read-only: Pebbles anti-gaming Plan 1 Phase 1
// (docs/pebbles-anti-gaming-and-prizes-plan.md). Trust is a hidden
// reputation score -- never shown to spotters -- so this is the only place
// to sanity-check the propagation algorithm and the prize-eligibility gate
// against real data before trusting the PRIZE_TRUST_BAR default.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Trust · FishSpotter admin" };

export default async function AdminTrustPage() {
  const now = new Date();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      name: true,
      isTrustSeed: true,
      trustScore: true,
      trustUpdatedAt: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { trustScore: "desc" },
  });

  const answers = await prisma.answer.findMany({ select: { userId: true, createdAt: true } });
  const datesByUser = new Map<string, Date[]>();
  for (const a of answers) {
    const list = datesByUser.get(a.userId);
    if (list) list.push(a.createdAt);
    else datesByUser.set(a.userId, [a.createdAt]);
  }

  const rows = users.map((u) => {
    const verdict = isPrizeEligible(
      {
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        trustScore: u.trustScore,
        answerDates: datesByUser.get(u.id) ?? [],
      },
      now,
    );
    return { ...u, ...verdict };
  });

  return (
    <div>
      <h1 className="font-brand text-xl font-semibold text-navy-900">Trust &amp; prize eligibility</h1>
      <p className="mt-1 text-sm text-navy-600">
        Hidden reputation score, propagated from trust-seed accounts via co-occurrence in winning
        consensus camps (Plan 1 Phase 1). Never shown to spotters — gates prize eligibility only,
        never removes Pebbles or status.
      </p>
      <p className="mt-2 text-[12px] text-navy-500">
        {users.length} accounts · {users.filter((u) => u.isTrustSeed).length} trust seeds ·{" "}
        {rows.filter((r) => r.eligible).length} currently prize-eligible
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-navy-200/60 bg-white">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-navy-200/60 text-[10px] font-semibold uppercase tracking-wide text-navy-500">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Seed</th>
              <th className="px-3 py-2">Trust</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Eligible</th>
              <th className="px-3 py-2">Reasons</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-200/60">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-navy-900">{r.displayName || r.name || r.email}</td>
                <td className="px-3 py-2">
                  {r.isTrustSeed ? (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                      Seed
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums text-navy-900">{r.trustScore.toFixed(1)}</td>
                <td className="px-3 py-2 text-navy-500">
                  {r.trustUpdatedAt ? r.trustUpdatedAt.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2 text-navy-500">{r.emailVerified ? "yes" : "no"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.eligible ? "bg-teal-100 text-teal-800" : "bg-navy-100 text-navy-700"
                    }`}
                  >
                    {r.eligible ? "Eligible" : "Not yet"}
                  </span>
                </td>
                <td className="px-3 py-2 text-navy-500">{r.reasons.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
