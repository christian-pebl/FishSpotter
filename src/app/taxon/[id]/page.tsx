import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function emojiForName(n: string): string {
  const lc = n.toLowerCase();
  if (lc.includes("crab")) return "🦀";
  if (lc.includes("jelly") || lc.includes("ctenophora")) return "🪼";
  if (lc.includes("squid")) return "🦑";
  if (lc.includes("starfish")) return "⭐";
  if (lc.includes("whelk") || lc.includes("snail") || lc.includes("gastropod")) return "🐚";
  if (lc.includes("shark") || lc.includes("nursehound") || lc.includes("catshark")) return "🦈";
  return "🐟";
}

export default async function TaxonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taxon = await prisma.taxon.findUnique({
    where: { id },
    include: {
      snippets: {
        select: {
          id: true,
          externalId: true,
          thumbnailUrl: true,
          site: true,
          recordingDatetime: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      aliases: { select: { display: true, source: true } },
    },
  });
  if (!taxon) notFound();

  const localNames = taxon.aliases.filter((a) => a.source === "common" || a.source === "vernacular");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 text-[color:var(--foreground)]">
      <p className="mb-4">
        <Link href="/me/taxa" className="pebl-button-secondary inline-flex rounded-full px-4 py-2 text-sm font-medium">
          ← Back to your life list
        </Link>
      </p>

      <div className="pebl-surface rounded-[24px] p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex h-32 w-32 flex-none items-center justify-center overflow-hidden rounded-2xl bg-[color:var(--surface-muted)]">
            {taxon.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={taxon.heroImageUrl} alt={taxon.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-6xl">{emojiForName(taxon.name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              {taxon.isFunctionalGroup ? "Functional group" : "Species"}
            </p>
            <h1 className="font-brand-heading text-3xl">{taxon.name}</h1>
            {taxon.scientificName && (
              <p className="mt-1 text-base italic text-[color:var(--muted)]">{taxon.scientificName}</p>
            )}
            {localNames.length > 0 && (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Also known as: {localNames.map((a) => a.display).join(", ")}
              </p>
            )}
          </div>
        </div>

        {taxon.funFact && (
          <div className="mt-5 rounded-2xl bg-[color:var(--primary)]/10 p-4">
            <p className="text-sm text-[color:var(--foreground)]">
              <span className="mr-1">💡</span>
              {taxon.funFact}
            </p>
          </div>
        )}

        {taxon.description && (
          <p className="mt-5 text-sm leading-relaxed text-[color:var(--foreground)]">
            {taxon.description}
          </p>
        )}

        {taxon.habitatNote && (
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            <span className="font-semibold text-[color:var(--foreground)]">Habitat: </span>
            {taxon.habitatNote}
          </p>
        )}
      </div>

      {taxon.snippets.length > 0 && (
        <div className="mt-6 pebl-surface rounded-[24px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
            Clips of this {taxon.isFunctionalGroup ? "group" : "species"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {taxon.snippets.map((s) => (
              <Link key={s.id} href={`/feed/${s.id}`} className="block">
                <div className="aspect-square overflow-hidden rounded-xl bg-[color:var(--surface-muted)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnailUrl} alt={s.externalId} className="h-full w-full object-cover" />
                </div>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{s.site}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
