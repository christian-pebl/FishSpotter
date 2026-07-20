import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Gated by the /admin layout (requireAdminSession). Impact dashboard for the
// National Lottery Climate Action Fund: reach, engagement depth, and learning
// outcomes. Engagement counts come from the consent-gated Event log; learning /
// identification counts are derived from the existing Answer / UnlockedSpecies
// tables (not duplicated). All aggregate — no individual is profiled here.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Metrics · FishSpotter admin" };

const DAY_MS = 24 * 60 * 60 * 1000;

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-card border border-navy-200/60 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-teal-600">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-navy-600">{sub}</p>}
    </div>
  );
}

export default async function MetricsPage() {
  const since30 = new Date(Date.now() - 30 * DAY_MS);

  const [
    totalSignups,
    newSignups30,
    sessions30,
    activeSpotters30,
    watchAll,
    watch30,
    clipViews,
    identifications,
    verdicts,
    correct,
    speciesUnlocks,
    sourceRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.event.count({ where: { type: "session_start", createdAt: { gte: since30 } } }),
    prisma.event.groupBy({
      by: ["userId"],
      where: { type: "session_start", createdAt: { gte: since30 }, userId: { not: null } },
    }),
    prisma.event.aggregate({ _sum: { value: true }, where: { type: "clip_watch" } }),
    prisma.event.aggregate({
      _sum: { value: true },
      where: { type: "clip_watch", createdAt: { gte: since30 } },
    }),
    prisma.event.count({ where: { type: "clip_view" } }),
    prisma.answer.count(),
    prisma.answer.count({ where: { isCorrect: { not: null } } }),
    prisma.answer.count({ where: { isCorrect: true } }),
    prisma.unlockedSpecies.count(),
    prisma.event.groupBy({
      by: ["utmSource", "referrer"],
      where: { type: "session_start", createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const topSources = sourceRows
    .map((r) => ({
      label: r.utmSource ?? r.referrer ?? "direct / unknown",
      count: r._count._all,
    }))
    .filter((r) => r.count > 0);

  const watchMinAll = Math.round((watchAll._sum.value ?? 0) / 60);
  const watchMin30 = Math.round((watch30._sum.value ?? 0) / 60);
  const accuracy = verdicts > 0 ? Math.round((correct / verdicts) * 100) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-lg font-semibold text-navy-900">Impact metrics</h1>
          <p className="mt-1 text-[12px] text-navy-600">
            Aggregate engagement &amp; learning for funder reporting. Engagement is
            counted only for spotters who accepted analytics.
          </p>
        </div>
        <Link
          href="/api/admin/metrics/export"
          className="pebl-button-secondary rounded-full px-4 py-2 text-xs font-semibold"
        >
          Export CSV (90 days)
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
          Reach
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Spotters" value={totalSignups.toLocaleString()} sub="total signups" />
          <StatCard label="New (30d)" value={newSignups30.toLocaleString()} sub="signups, last 30 days" />
          <StatCard label="Active (30d)" value={activeSpotters30.length.toLocaleString()} sub="spotters with a session" />
          <StatCard label="Sessions (30d)" value={sessions30.toLocaleString()} sub="tab sessions" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
          Engagement
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Watch time" value={`${watchMinAll.toLocaleString()} min`} sub="active viewing, all time" />
          <StatCard label="Watch (30d)" value={`${watchMin30.toLocaleString()} min`} sub="active viewing, last 30 days" />
          <StatCard label="Clips watched" value={clipViews.toLocaleString()} sub="clip views logged" />
          <StatCard label="Identifications" value={identifications.toLocaleString()} sub="IDs submitted" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
          Top sources (30d)
        </h2>
        {topSources.length === 0 ? (
          <p className="text-[12px] text-navy-600">No sessions with attribution yet.</p>
        ) : (
          <div className="rounded-card border border-navy-200/60 bg-white p-4">
            <ul className="divide-y divide-navy-200/60">
              {topSources.map((s) => (
                <li key={s.label} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-navy-900">{s.label}</span>
                  <span className="tabular-nums font-semibold text-navy-900">{s.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
          Learning
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Species learned"
            value={speciesUnlocks.toLocaleString()}
            sub="collection unlocks"
          />
          <StatCard
            label="Consensus accuracy"
            value={accuracy == null ? "—" : `${accuracy}%`}
            sub="IDs matching the community"
          />
        </div>
      </section>
    </div>
  );
}
