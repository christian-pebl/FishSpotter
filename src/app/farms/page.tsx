import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { FARMS } from "@/lib/farms/catalogue";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The seaweed farms · FishSpotter",
  description:
    "Meet the six UK seaweed farms behind FishSpotter's clips: real growers turning kelp into biostimulants for climate-smart farming.",
};

export default async function FarmsIndexPage() {
  const farms = Object.values(FARMS);

  // One query for live clip counts, keyed by deployment, so every farm card
  // can show real numbers instead of static copy.
  const counts = await prisma.snippet.groupBy({
    by: ["deployment"],
    where: excludeBlockedSnippetsWhere(),
    _count: { _all: true },
  });
  const countByDeployment = new Map(counts.map((c) => [c.deployment, c._count._all]));
  const clipCount = (deploymentNames: string[]) =>
    deploymentNames.reduce((sum, d) => sum + (countByDeployment.get(d) ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <Link
          href="/feed"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted hover:text-teal-600"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to the feed
        </Link>

        <header className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">Where the clips come from</p>
          <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">The seaweed farms</h1>
          <p className="mt-2 max-w-xl text-sm text-navy-900/70">
            Every clip in FishSpotter is filmed beneath a real, working seaweed farm. Most of what
            these farms grow doesn&apos;t end up on a plate: it&apos;s dried, pressed and sprayed
            onto fields as a biostimulant, a natural alternative to synthetic fertiliser that helps
            crops grow stronger roots, resist drought and disease, and draw in minerals the soil
            has lost. PEBL monitors the water beneath six of these farms as part of a National
            Lottery Climate Action Fund project with WWF: the fish you&apos;re spotting live in the
            same water that grows that crop.
          </p>
        </header>

        <ul className="mt-6 flex flex-col gap-3">
          {farms.map((farm) => {
            const clips = clipCount(farm.deploymentNames);
            return (
              <li key={farm.slug}>
                <Link
                  href={`/farms/${farm.slug}`}
                  className="pebl-surface group flex items-center justify-between gap-4 rounded-card p-4 transition-colors hover:bg-teal-50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
                      {farm.location.place}
                    </p>
                    <h2 className="mt-0.5 font-brand-heading text-h3 text-navy-900">{farm.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-navy-900/70">{farm.mission}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {clips > 0 ? (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 group-hover:bg-white">
                        {clips} clip{clips === 1 ? "" : "s"} filmed here
                      </span>
                    ) : (
                      <span className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[11px] font-medium text-navy-900/50">
                        Monitoring starting soon
                      </span>
                    )}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-teal-400">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
