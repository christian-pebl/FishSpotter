import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { datesFromAnswers, readStreak } from "@/lib/streak-service";
import { prisma } from "@/lib/prisma";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";
import { SpeciesCollection } from "@/components/species/SpeciesCollection";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { displayName: true, name: true },
  });
  if (!user) return { title: "Spotter" };
  const name = user.displayName ?? user.name ?? "Spotter";
  const description = `${name}'s PEBL FishSpotter profile: species spotted, score, and streak.`;
  return {
    title: name,
    description,
    openGraph: { title: name, description },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      name: true,
      createdAt: true,
    },
  });
  if (!user) notFound();

  // Individual answers (which clip you guessed what on) are private: visible
  // only to YOU on your own profile, or to staff (@pebl-cic.co.uk). Everyone
  // else sees the aggregate stats + species collection, not the per-clip list.
  const isOwner = viewerId === id;
  let canSeeAnswers = isOwner;
  if (viewerId && !isOwner) {
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { email: true, emailVerified: true },
    });
    canSeeAnswers = isAdminUser(viewer);
  }

  const [
    totalAnswers,
    correctAnswers,
    recentAnswers,
    allAnswerDates,
    pointsAgg,
    resolvedAnswers,
  ] =
    await Promise.all([
      prisma.answer.count({ where: { userId: id } }),
      prisma.answer.count({ where: { userId: id, isCorrect: true } }),
      prisma.answer.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          chosenOption: true,
          isCorrect: true,
          createdAt: true,
          snippet: { select: { id: true, site: true, deployment: true, staffAnswer: true } },
        },
      }),
      prisma.answer.findMany({
        where: { userId: id },
        select: { createdAt: true },
        // Hardening: bound the per-user history scan (see POST /api/answers).
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.answer.aggregate({ where: { userId: id }, _sum: { points: true } }),
      prisma.answer.count({ where: { userId: id, isCorrect: { not: null } } }),
    ]);

  const streak = await readStreak(prisma, id, datesFromAnswers(allAnswerDates));
  const displayName = user.displayName ?? user.name ?? "Spotter";
  // Score mirrors the leaderboard (sum of Answer.points) so the two pages
  // reconcile. Accuracy is over RESOLVED answers only (isCorrect not null):
  // pending answers on no-reference clips earn a bonus and must not count as
  // wrong, which would silently drag the percentage down.
  const score = pointsAgg._sum.points ?? 0;
  // T-02: never show "0%" to a newcomer (a blunt, often-wrong judgement at n=1).
  // Withhold accuracy until there are at least 5 scored answers.
  const accuracy =
    resolvedAnswers >= 5
      ? `${Math.round((correctAnswers / resolvedAnswers) * 100)}%`
      : "-";

  return (
    <MarineBackdrop>
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10 min-h-0 overflow-y-auto"
    >
      <BackToFeed />
      <section className="pebl-surface overflow-hidden rounded-card p-6 md:p-8">
        <p className="pebl-eyebrow">Spotter profile</p>
        <h1 className="mt-2 font-brand text-h1 text-navy-900">{displayName}</h1>
        <p className="mt-1 text-xs text-navy-900/55">
          Joined {user.createdAt.toLocaleDateString()}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Identifications</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{totalAnswers}</dd>
          </div>
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Score</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{score}</dd>
          </div>
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Accuracy</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{accuracy}</dd>
          </div>
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Streak</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{streak}</dd>
          </div>
        </dl>
        {totalAnswers > 0 && (
          <p className="mt-3 text-xs leading-5 text-navy-900/60">
            Your {totalAnswers} {totalAnswers === 1 ? "identification feeds" : "identifications feed"} PEBL&apos;s UK seabed monitoring record.
          </p>
        )}
      </section>

      <SpeciesCollection userId={id} />

      {canSeeAnswers && (
      <section className="pebl-surface rounded-card p-6">
        <p className="pebl-eyebrow">Recent identifications</p>
        {recentAnswers.length === 0 ? (
          <p className="mt-3 text-sm text-navy-900/55">No identifications yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentAnswers.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/feed/${a.snippet.id}`}
                    className="font-medium text-navy-900 hover:text-teal-700"
                  >
                    {a.snippet.site} · {a.snippet.deployment}
                  </Link>
                  <p className="truncate text-xs text-navy-900/55">
                    {a.chosenOption}
                    {a.isCorrect === false && a.snippet.staffAnswer &&
                      ` (was ${a.snippet.staffAnswer})`}
                    {a.isCorrect === null && " (reference pending, bonus awarded)"}
                  </p>
                </div>
                <span
                  role="img"
                  className={
                    a.isCorrect === true
                      ? "rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-teal-700"
                      : a.isCorrect === false
                        ? "rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-danger"
                        : "rounded-full bg-pending px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-pending-ink"
                  }
                  aria-label={
                    a.isCorrect === true
                      ? "Correct"
                      : a.isCorrect === false
                        ? "Incorrect"
                        : "Bonus, reference pending"
                  }
                  title={
                    a.isCorrect === null
                      ? "Bonus: no reference identification yet"
                      : undefined
                  }
                >
                  {a.isCorrect === true ? (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : a.isCorrect === false ? (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </main>
    </MarineBackdrop>
  );
}
