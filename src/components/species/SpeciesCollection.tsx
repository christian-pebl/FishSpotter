import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesSlug } from "@/lib/species-slug";

/**
 * Pokedex collection grid for a spotter (Anjali feedback). Every catalogue
 * species is a tile; species the user has correctly identified are "collected"
 * (photo + name, links to the profile), the rest are greyed silhouettes. A
 * per-shape-class badge row shows progress ("Crab 3/6"). Pure server component.
 */
export async function SpeciesCollection({ userId }: { userId: string }) {
  const [unlockedRows, curated] = await Promise.all([
    prisma.unlockedSpecies.findMany({ where: { userId }, select: { scientificName: true } }),
    prisma.speciesImage.findMany({
      where: { curated: true },
      select: { scientificName: true, url: true, webpUrl: true, ordering: true },
      orderBy: { ordering: "asc" },
    }),
  ]);

  const unlocked = new Set(unlockedRows.map((r) => r.scientificName));
  const thumb = new Map<string, string>();
  for (const img of curated) {
    if (!thumb.has(img.scientificName)) thumb.set(img.scientificName, img.webpUrl ?? img.url);
  }

  const species = Object.entries(CATALOGUE)
    .map(([sci, t]) => ({
      sci,
      common: t.commonName,
      shapeClass: t.shapeClass,
      slug: speciesSlug(sci),
      isUnlocked: unlocked.has(sci),
      thumb: thumb.get(sci),
    }))
    .sort((a, b) => a.shapeClass.localeCompare(b.shapeClass) || a.common.localeCompare(b.common));

  const total = species.length;
  const collected = species.filter((s) => s.isUnlocked).length;
  const pct = total ? Math.round((collected / total) * 100) : 0;

  const byClass = new Map<string, { u: number; t: number }>();
  for (const s of species) {
    const e = byClass.get(s.shapeClass) ?? { u: 0, t: 0 };
    e.t++;
    if (s.isUnlocked) e.u++;
    byClass.set(s.shapeClass, e);
  }
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <section className="pebl-surface rounded-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="pebl-eyebrow">Collection</p>
        <p className="text-xs font-medium text-navy-900/60">
          {collected} of {total} species
        </p>
      </div>

      {/* progress */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
      </div>

      {/* per-shape-class badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...byClass.entries()].map(([cls, e]) => {
          const done = e.u === e.t;
          return (
            <span
              key={cls}
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
                (done
                  ? "bg-teal-500/15 text-teal-700"
                  : "bg-surface-muted text-navy-900/70")
              }
            >
              {cap(cls)} {e.u}/{e.t}
              {done && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                  <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          );
        })}
      </div>

      {/* grid */}
      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {species.map((s) =>
          s.isUnlocked ? (
            <li key={s.sci}>
              <Link href={`/species/${s.slug}`} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-modal bg-navy-900 ring-1 ring-teal-500/40">
                  {s.thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- external iNat thumb */
                    <img
                      src={s.thumb}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-white/60">
                      {s.common}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] font-medium text-navy-900" title={s.common}>
                  {s.common}
                </p>
              </Link>
            </li>
          ) : (
            <li key={s.sci}>
              <div
                role="img"
                className="relative flex aspect-square items-center justify-center rounded-modal bg-surface-muted"
                aria-label={`${cap(s.shapeClass)}, not yet collected`}
                title="Not yet collected"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local silhouette asset */}
                <img
                  src={`/silhouettes/${s.shapeClass}.svg`}
                  alt=""
                  aria-hidden="true"
                  className="h-1/2 w-1/2 object-contain opacity-15"
                />
              </div>
              <p className="mt-1 truncate text-[11px] text-navy-900/35">Locked</p>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
