import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadMetricsView } from "@/lib/metrics/query";
import { dayKey, metricRangeQuery } from "@/lib/metrics/range";
import { MetricsDashboard } from "./MetricsDashboard";

// Gated by the /admin layout (requireAdminSession). Impact dashboard for the
// National Lottery Climate Action Fund: reach, engagement depth, and learning
// outcomes. Engagement counts come from the consent-gated Event log; learning /
// identification counts are derived from the existing Answer / UnlockedSpecies
// tables (not duplicated). All aggregate, no individual is profiled here.
//
// The selected range lives in the URL, so this server component renders the
// numbers the admin asked for on the first paint. `MetricsDashboard` adds only
// the interaction on top: which card is open, and the range picker's navigation.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Metrics · FishSpotter admin" };

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const view = await loadMetricsView(prisma, searchParams);
  const { range } = view;
  const lastDay = range.days[range.days.length - 1] ?? dayKey(new Date());

  return (
    <MetricsDashboard
      series={view.series}
      days={range.days}
      preset={range.preset}
      rangeLabel={range.label}
      fromDay={range.days[0] ?? lastDay}
      toDay={lastDay}
      todayDay={dayKey(new Date())}
      previousTotals={view.previousTotals}
      previousLabel={view.previousLabel}
      firstEventDay={view.firstEventAt ? dayKey(view.firstEventAt) : null}
      topSources={view.topSources}
      exportHref={`/api/admin/metrics/export?${metricRangeQuery(range).toString()}`}
      coerced={range.coerced}
    />
  );
}
