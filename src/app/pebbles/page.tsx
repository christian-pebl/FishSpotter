import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SEASEARCH_GUIDE_ID } from "@/lib/prize";
import { isPrizeEligible } from "@/lib/trust";
import { datesFromAnswers, readStreak } from "@/lib/streak-service";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";
import { PrizeCard } from "@/components/PrizeCard";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";

// Per-viewer (session-dependent), never cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats",
};

/**
 * The single Pebbles destination (the old Shop | Leaderboard tabs collapsed
 * into one page, 20 Jul 2026): your totals, your progress toward winning the
 * Seasearch guide, and the community ranking — one streamlined view.
 */
export default async function PebblesHubPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const leaderboardPage = Number(rawPage) || 1;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  let banner: { earned: number; streak: number } | null = null;
  let claimed = false;
  let eligibility: { eligible: boolean; reason: string | null } | null = null;

  if (userId) {
    const [pointsAgg, answerDates, claim, user] = await Promise.all([
      prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
      prisma.answer.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.pebblePurchase.findFirst({
        where: { userId, itemId: SEASEARCH_GUIDE_ID },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true, createdAt: true, trustScore: true },
      }),
    ]);
    const earned = pointsAgg._sum.points ?? 0;
    const streak = await readStreak(prisma, userId, datesFromAnswers(answerDates));
    banner = { earned, streak };
    claimed = !!claim;

    if (user) {
      // Precomputed so the prize card pre-warns ("verify your email") instead
      // of surprising a spotter at 1,000 Pebbles. The claim route re-checks
      // server-side regardless; this copy is UX, not enforcement.
      const result = isPrizeEligible(
        {
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          trustScore: user.trustScore,
          answerDates: answerDates.map((a) => a.createdAt),
        },
        new Date(),
      );
      eligibility = {
        eligible: result.eligible,
        reason: result.eligible
          ? null
          : result.reasons.includes("email not verified")
            ? "Verify your email to claim the guide — prizes are posted to real spotters."
            : "Prize claims unlock with more spotting history across more days.",
      };
    }
  }

  return (
    <MarineBackdrop>
      <div className="flex-1 overflow-y-auto">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8"
        >
          <BackToFeed />

          <section className="pebl-surface rounded-card px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
              Pebbles
            </p>
            <h1 className="mt-2 font-brand text-h1 text-navy-900">Your Pebbles</h1>
            {banner ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-card border border-navy-900/12 p-3">
                  <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">
                    Pebbles earned
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-teal-700">
                    {banner.earned.toLocaleString()}
                  </dd>
                </div>
                <div className="rounded-card border border-navy-900/12 p-3">
                  <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">
                    Streak
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-navy-900">{banner.streak}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-navy-900/72">
                Earn Pebbles by identifying clips in the feed — they count toward the prize below
                and your leaderboard rank.
              </p>
            )}
          </section>

          <PrizeCard
            authed={!!userId}
            initialEarned={banner?.earned ?? 0}
            initiallyClaimed={claimed}
            eligibility={eligibility}
          />

          <LeaderboardPanel page={leaderboardPage} />
        </main>
      </div>
    </MarineBackdrop>
  );
}
