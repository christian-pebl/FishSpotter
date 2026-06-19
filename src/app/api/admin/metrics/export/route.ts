import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Funder-facing CSV: per-day aggregates for the last 90 days. Self-gated (admin
// only) since API routes don't run under the /admin layout. Aggregate only.
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 90 * DAY_MS);

  const [users, events, answers] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.event.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, type: true, value: true },
    }),
    prisma.answer.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  type Row = {
    newSignups: number;
    sessions: number;
    watchSeconds: number;
    clipsWatched: number;
    identifications: number;
  };
  const byDay = new Map<string, Row>();
  const row = (k: string): Row => {
    let r = byDay.get(k);
    if (!r) {
      r = { newSignups: 0, sessions: 0, watchSeconds: 0, clipsWatched: 0, identifications: 0 };
      byDay.set(k, r);
    }
    return r;
  };

  for (const u of users) row(dayKey(u.createdAt)).newSignups++;
  for (const a of answers) row(dayKey(a.createdAt)).identifications++;
  for (const e of events) {
    const r = row(dayKey(e.createdAt));
    if (e.type === "session_start") r.sessions++;
    else if (e.type === "clip_view") r.clipsWatched++;
    else if (e.type === "clip_watch") r.watchSeconds += e.value ?? 0;
  }

  const header = "date,new_signups,sessions,watch_minutes,clips_watched,identifications";
  const lines = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([day, r]) =>
        `${day},${r.newSignups},${r.sessions},${Math.round(r.watchSeconds / 60)},${r.clipsWatched},${r.identifications}`,
    );
  const csv = [header, ...lines].join("\n") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fishspotter-metrics-${dayKey(new Date())}.csv"`,
    },
  });
}
