import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesSlug } from "@/lib/species-slug";
import { UnlockTile, ProgressBadge } from "@/components/species/UnlockTile";

/**
 * Pokedex collection grid for a spotter (Anjali feedback). Every catalogue
 * species is a tile; species the user has correctly identified are "collected"
 * (photo + name, links to the profile), the rest are greyed silhouettes. A
 * per-shape-class badge row shows progress ("Crab 3/6"). Server component; the
 * collected tiles + the badges are client islands (`UnlockTile`/`ProgressBadge`)
 * so a freshly-unlocked species can play its reveal without making the whole
 * grid client-rendered.
 *
 * `justUnlockedSci` is the best-effort "which species did the spotter just
 * collect" hook: when the caller knows it (e.g. a `?unlocked=<scientificName>`
 * param on the profile after a correct ID), that one tile dissolves in and its
 * shape-class badge ticks up by one. Left undefined, everything renders at rest
 * (no animation). Deliberately not wired into routing here — that is the
 * caller's call.
 */
export async function SpeciesCollection({
  userId,
  justUnlockedSci,
}: {
  userId: string;
  justUnlockedSci?: string;
}) {
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

  // Best-effort: only treat a just-unlocked species as "fresh" if it is actually
  // collected (so a stale/bogus param can't fire the reveal on a locked tile).
  const justUnlockedClass =
    justUnlockedSci && unlocked.has(justUnlockedSci)
      ? CATALOGUE[justUnlockedSci]?.shapeClass
      : undefined;

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

      {/* per-shape-class badges; the just-unlocked class's badge ticks up by one */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...byClass.entries()].map(([cls, e]) => (
          <ProgressBadge
            key={cls}
            label={cap(cls)}
            unlocked={e.u}
            total={e.t}
            justTicked={cls === justUnlockedClass}
          />
        ))}
      </div>

      {/* How collecting works — and an honest note that some clips the PEBL team
          can only identify to group level, so they score but never unlock a
          species (no species-level reference exists for them). */}
      <p className="mt-3 text-[11px] leading-relaxed text-navy-900/55">
        Correctly name a species to add it to your collection. Some clips can only
        be identified to a group (e.g. &ldquo;a crab&rdquo;) even by the PEBL team:
        those still earn points, but don&rsquo;t unlock a species.
      </p>

      {/* grid */}
      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {species.map((s) =>
          s.isUnlocked ? (
            <UnlockTile
              key={s.sci}
              photoUrl={s.thumb}
              commonName={s.common}
              slug={s.slug}
              shapeClass={s.shapeClass}
              justUnlocked={s.sci === justUnlockedSci && justUnlockedClass !== undefined}
            />
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
