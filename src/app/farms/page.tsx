import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { FARMS } from "@/lib/farms/catalogue";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About the project · FishSpotter",
  description:
    "FishSpotter is part of Unlocking the Power of Seaweed, a National Lottery Climate Action Fund project with WWF. PEBL is gathering biodiversity trends at six UK seaweed and shellfish farms to understand how they interact with the ecosystem around them.",
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
          <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">About the Project</h1>
          <p className="mt-2 max-w-xl text-sm text-navy-900/70">
            Every clip in FishSpotter is filmed beneath a real, working seaweed and shellfish farm.
            Most of what these farms grow doesn&apos;t end up on a plate: it&apos;s dried, pressed
            and sprayed onto fields as a biostimulant, a natural alternative to synthetic fertiliser
            that helps crops grow stronger roots, resist drought and disease, and draw in minerals
            the soil has lost. PEBL monitors the water beneath six of these farms as part of a
            National Lottery Climate Action Fund project with WWF: the fish you&apos;re spotting
            live in the same water that grows that crop.
          </p>
        </header>

        <section className="pebl-surface mt-6 rounded-card p-4 sm:p-6" aria-labelledby="about-programme">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">The programme</p>
          <h2 id="about-programme" className="mt-1 font-brand-heading text-h3 text-navy-900">
            Unlocking the Power of Seaweed
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-900/80">
            FishSpotter is one part of <em>Unlocking the Power of Seaweed</em>, a three-year, £1
            million project funded by The National Lottery Community Fund&apos;s Climate Action
            Fund. WWF-UK leads it alongside Câr-y-Môr in St Davids, the Scottish Association for
            Marine Science and PEBL, working with coastal communities to build a model of
            community-led regenerative seaweed farming and to help a responsible UK-wide industry
            grow.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-navy-900/80">
            The case for these farms is that they can do more than produce a crop. Regenerative
            seaweed and shellfish farms can supply sustainable food and seaweed-derived products,
            from animal feed to fertilisers, while also providing ecosystem services: mitigating
            climate change, improving water quality, enhancing biodiversity and supporting coastal
            economies. PEBL&apos;s job in the partnership is to check that in the water, monitoring
            what seaweed and shellfish farms do to marine life and building an open-access record
            that farmers and communities can feed into directly.
          </p>
        </section>

        <section className="mt-6" aria-labelledby="about-question">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">What we&apos;re trying to find out</p>
          <h2 id="about-question" className="mt-1 font-brand-heading text-h3 text-navy-900">
            Biodiversity trends, farm by farm
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-900/80">
            We are gathering biodiversity trends at seaweed and shellfish farms, so we can better
            understand the interactions between those farms and the ecosystem around them. Nobody
            has that answer yet at any scale. UK seaweed and shellfish farming is young, the sites
            are small, and most of what gets said about their effect on marine life is inference
            rather than measurement.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-navy-900/80">
            So PEBL films. Underwater cameras sit on the seabed beneath the growing lines and at
            nearby control sites away from the farm, season after season, so what lives under a farm
            can be compared with what lives without one. Earlier PEBL monitoring at Câr-y-Môr across
            2022 and 2023 set the baseline: baited underwater video recorded 13 kinds of mobile
            animal, and acoustic recorders caught dolphin and porpoise activity shifting with the
            seasons. Enough to show that routine, integrated monitoring is worth doing. Nowhere near
            enough to call a trend.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-navy-900/80">
            A trend needs far more footage than a small team can watch on its own. That is what
            FishSpotter is for: every clip you identify turns a few seconds of seabed video into a
            record of what was living there, at which farm, on which day.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-navy-900/50">
            Project detail from{" "}
            <a
              href="https://www.wwf.org.uk/updates/unlocking-power-seaweed-pembrokeshire"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-teal-600"
            >
              WWF-UK
            </a>{" "}
            and{" "}
            <a
              href="https://www.tnlcommunityfund.org.uk/funding/programmes/climate-action-fund"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-teal-600"
            >
              The National Lottery Climate Action Fund
            </a>
            . The Câr-y-Môr baseline figures come from PEBL&apos;s own 2022&ndash;23 monitoring,{" "}
            <a
              href="https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1.full"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-teal-600"
            >
              published in full here
            </a>
            .
          </p>
        </section>

        <section className="mt-8" aria-labelledby="the-farms">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">Where we film</p>
          <h2 id="the-farms" className="mt-1 font-brand-heading text-h3 text-navy-900">
            The farms we monitor
          </h2>
          <p className="mt-2 max-w-xl text-sm text-navy-900/70">
            Six UK seaweed and shellfish farms, from Pembrokeshire to Skye. Each one grows a
            slightly different crop, for slightly different reasons.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {farms.map((farm) => {
              const clips = clipCount(farm.deploymentNames);
              return (
                <li key={farm.slug}>
                  <Link
                    href={`/farms/${farm.slug}`}
                    className="pebl-surface group flex items-stretch gap-3 overflow-hidden rounded-card p-3 transition-colors hover:bg-teal-50"
                  >
                    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-modal bg-gradient-to-br from-teal-500/25 to-navy-900/20 sm:w-28">
                      {farm.media?.hero && (
                        /* eslint-disable-next-line @next/next/no-img-element -- local static asset */
                        <img
                          src={farm.media.hero.src}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-teal-600">
                        {farm.location.place}
                      </p>
                      <h3 className="mt-0.5 font-brand-heading text-h3 text-navy-900">{farm.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-navy-900/70">{farm.mission}</p>
                      <span className="mt-2 inline-flex w-fit items-center gap-1">
                        {clips > 0 ? (
                          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 group-hover:bg-white">
                            {clips} clip{clips === 1 ? "" : "s"} filmed here
                          </span>
                        ) : (
                          <span className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[11px] font-medium text-navy-900/50">
                            Monitoring starting soon
                          </span>
                        )}
                      </span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 self-center text-teal-400"
                    >
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
