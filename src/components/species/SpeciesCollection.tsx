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
    // T-02: collected species lead, so the grid opens on progress, not a wall.
    .sort(
      (a, b) =>
        Number(b.isUnlocked) - Number(a.isUnlocked) ||
        a.shapeClass.localeCompare(b.shapeClass) ||
        a.common.localeCompare(b.common),
    );

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
  // T-30: friendlier group names (the raw shape-class keys read as jargon).
  const CLASS_LABEL: Record<string, string> = { gastropod: "Sea snails" };
  const niceClass = (v: string) => CLASS_LABEL[v] ?? cap(v);

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
          {collected === 0
            ? `${total} species to discover`
            : `${collected} discovered · ${total - collected} to find`}
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
            label={niceClass(cls)}
            unlocked={e.u}
            total={e.t}
            justTicked={cls === justUnlockedClass}
          />
        ))}
      </div>

      {/* How collecting works — and an honest note that some clips the PEBL team
          can only identify to group level, so they score but never unlock a
          species (no species-level reference exists for them). */}
      <p className="mt-3 text-[10px] leading-relaxed text-navy-900/45">
        Tip: some clips are only identifiable to a group (like &ldquo;a crab&rdquo;),
        so they score points without unlocking a species.
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
                aria-label={`${niceClass(s.shapeClass)}, not yet collected`}
                title={`${s.common} — name it in a clip to collect it`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local silhouette asset */}
                <img
                  src={`/silhouettes/${s.shapeClass}.svg`}
                  alt=""
                  aria-hidden="true"
                  className="h-1/2 w-1/2 object-contain opacity-15"
                />
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
