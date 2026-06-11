import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesSlug } from "@/lib/species-slug";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Species guide — FishSpotter",
  description: "Browse the UK marine species you can spot, with reference photos and field notes.",
};

const CLASS_LABEL: Record<string, string> = {
  fish: "Fish",
  flatfish: "Flatfish",
  crab: "Crabs",
  squid: "Squid & cuttlefish",
  starfish: "Starfish",
  gastropod: "Snails & slugs",
  jellyfish: "Jellyfish",
};

export default async function SpeciesIndexPage() {
  const curated = await prisma.speciesImage.findMany({
    where: { curated: true },
    select: { scientificName: true, url: true, webpUrl: true, ordering: true },
    orderBy: { ordering: "asc" },
  });
  const thumb = new Map<string, string>();
  for (const i of curated) if (!thumb.has(i.scientificName)) thumb.set(i.scientificName, i.webpUrl ?? i.url);

  const byClass = new Map<string, { sci: string; common: string; slug: string; thumb?: string }[]>();
  for (const [sci, t] of Object.entries(CATALOGUE)) {
    const arr = byClass.get(t.shapeClass) ?? [];
    arr.push({ sci, common: t.commonName, slug: speciesSlug(sci), thumb: thumb.get(sci) });
    byClass.set(t.shapeClass, arr);
  }
  for (const arr of byClass.values()) arr.sort((a, b) => a.common.localeCompare(b.common));
  const classes = [...byClass.keys()].sort((a, b) => (CLASS_LABEL[a] ?? a).localeCompare(CLASS_LABEL[b] ?? b));
  const total = Object.keys(CATALOGUE).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
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
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">Species guide</p>
        <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">What you can spot</h1>
        <p className="mt-1 text-sm text-navy-900/70">
          {total} UK marine species, with reference photos, field notes and where each is seen.
        </p>
      </header>

      {classes.map((cls) => (
        <section key={cls} className="mt-6">
          <h2 className="mb-2 font-brand-heading text-h3 text-navy-900">{CLASS_LABEL[cls] ?? cls}</h2>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {byClass.get(cls)!.map((s) => (
              <li key={s.sci}>
                <Link href={`/species/${s.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-modal bg-navy-900 ring-1 ring-navy-900/10">
                    {s.thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- external iNat thumb */
                      <img
                        src={s.thumb}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-white/60">
                        {s.common}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] font-medium text-navy-900" title={s.common}>
                    {s.common}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
