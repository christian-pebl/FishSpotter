import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { loadMetricsView, metricsCsv } from "@/lib/metrics/query";
import { dayKey } from "@/lib/metrics/range";

// Funder-facing CSV: per-day aggregates for whatever range the dashboard is
// showing (`?range=90d`, or `?range=custom&from=...&to=...`, same params the
// page reads). Self-gated (admin only) since API routes don't run under the
// /admin layout. Aggregate only.
//
// It goes through `loadMetricsView` rather than re-querying, so the spreadsheet
// an admin sends a funder is built by the same code as the chart they read it
// off. The two cannot drift.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const view = await loadMetricsView(prisma, searchParams);
  const csv = metricsCsv(view.range, view.counts);

  const first = view.range.days[0] ?? dayKey(new Date());
  const last = view.range.days[view.range.days.length - 1] ?? first;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fishspotter-metrics-${first}-to-${last}.csv"`,
    },
  });
}
