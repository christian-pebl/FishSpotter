import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletState } from "@/lib/shop/wallet";
import { datesFromAnswers, readStreak } from "@/lib/streak-service";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";
import { ShopPanel } from "@/components/shop/ShopPanel";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";

// Per-viewer (session-dependent), never cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pebbles",
};

type Tab = "shop" | "leaderboard";

function PebbleGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default async function PebblesHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "leaderboard" ? "leaderboard" : "shop";

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // Banner balances (only for signed-in spotters).
  let banner: { earned: number; wallet: number; streak: number } | null = null;
  if (userId) {
    const [pointsAgg, purchases, answerDates] = await Promise.all([
      prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
      prisma.pebblePurchase.findMany({ where: { userId }, select: { pebbleCost: true } }),
      prisma.answer.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);
    const earned = pointsAgg._sum.points ?? 0;
    const { wallet } = walletState(earned, purchases);
    const streak = await readStreak(prisma, userId, datesFromAnswers(answerDates));
    banner = { earned, wallet, streak };
  }

  const tabClass = (t: Tab) =>
    `inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${
      tab === t
        ? "bg-teal-600 text-white"
        : "bg-[color:var(--surface)] text-navy-900/72 hover:text-navy-900"
    }`;

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
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">Pebbles</p>
            <h1 className="mt-2 font-brand-heading text-h1 text-navy-900">Your Pebbles</h1>
            {banner ? (
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-card border border-navy-900/12 p-3">
                  <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">To spend</dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 text-2xl font-bold text-teal-700">
                    <PebbleGlyph size={16} />
                    {banner.wallet.toLocaleString()}
                  </dd>
                </div>
                <div className="rounded-card border border-navy-900/12 p-3">
                  <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">
                    Earned all-time
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-navy-900">
                    {banner.earned.toLocaleString()}
                  </dd>
                </div>
                <div className="rounded-card border border-navy-900/12 p-3">
                  <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Streak</dt>
                  <dd className="mt-1 text-2xl font-bold text-navy-900">{banner.streak}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-navy-900/72">
                Earn Pebbles by identifying clips in the feed, then spend them here.
              </p>
            )}
          </section>

          <nav aria-label="Pebbles sections" className="flex gap-2">
            <Link href="/pebbles?tab=shop" className={tabClass("shop")} aria-current={tab === "shop"}>
              Shop
            </Link>
            <Link
              href="/pebbles?tab=leaderboard"
              className={tabClass("leaderboard")}
              aria-current={tab === "leaderboard"}
            >
              Leaderboard
            </Link>
          </nav>

          {tab === "shop" ? <ShopPanel /> : <LeaderboardPanel />}
        </main>
      </div>
    </MarineBackdrop>
  );
}
