import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { computeStreakFromAnswers } from "@/lib/streak";
import { prisma } from "@/lib/prisma";

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
  return { title: name, description: `${name}'s PEBL FishSpotter profile.` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [totalAnswers, correctAnswers, recentAnswers, allAnswerDates] =
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
      }),
    ]);

  const streak = computeStreakFromAnswers(allAnswerDates).currentStreak;
  const displayName = user.displayName ?? user.name ?? "Spotter";
  const accuracy =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10"
    >
      <section className="pebl-surface rounded-hero p-6 md:p-8">
        <p className="pebl-eyebrow">Spotter profile</p>
        <h1 className="mt-2 font-brand text-h1 text-navy-900">{displayName}</h1>
        <p className="mt-1 text-xs text-navy-900/55">
          Joined {user.createdAt.toLocaleDateString()}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Identifications</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{totalAnswers}</dd>
          </div>
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Accuracy</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{accuracy}%</dd>
          </div>
          <div className="rounded-card border border-navy-900/12 p-3">
            <dt className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">Streak</dt>
            <dd className="mt-1 text-2xl font-bold text-navy-900">{streak}</dd>
          </div>
        </dl>
      </section>

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
                    {!a.isCorrect && ` (was ${a.snippet.staffAnswer})`}
                  </p>
                </div>
                <span
                  className={
                    a.isCorrect
                      ? "rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-teal-700"
                      : "rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-danger"
                  }
                >
                  {a.isCorrect ? "✓" : "✗"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
