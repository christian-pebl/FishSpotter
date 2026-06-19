import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveSpeciesSlug } from "@/lib/species-slug";
import { getCachedDepth, getCachedDistribution } from "@/lib/biodiversity/species-cache";
import { SpeciesGuideContent, type SpeciesDepth } from "@/components/species/SpeciesGuideContent";

// Daily ISR: the OBIS depth/distribution fetches are cached per species for a
// day (a dedicated cache table comes with the pokedex schema work).
export const revalidate = 86400;

function prettify(v: string): string {
  const s = v.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = resolveSpeciesSlug(slug);
  if (!r) return { title: "Species not found" };
  const title = `${r.traits.commonName} (${r.scientificName}): FishSpotter`;
  const description = r.traits.fieldNote;
  // Reuse the species' curated reference photo (same row the gallery pins) as
  // the share-card image when one exists; otherwise the default OG card stands.
  const photo = await prisma.speciesImage.findFirst({
    where: { scientificName: r.scientificName, curated: true },
    orderBy: { ordering: "asc" },
    select: { url: true, webpUrl: true },
  });
  const imageUrl = photo ? (photo.webpUrl ?? photo.url) : null;
  if (!imageUrl) return { title, description };
  const images = [imageUrl];
  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function SpeciesProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = resolveSpeciesSlug(slug);
  if (!resolved) notFound();
  const { scientificName, traits } = resolved;

  // OBIS depth + distribution, SSR (ISR-cached, fail-soft) and passed into the
  // shared content so the profile keeps server rendering them.
  const [depth, distribution] = await Promise.all([
    getCachedDepth(scientificName),
    getCachedDistribution(scientificName),
  ]);
  const initialDepth: SpeciesDepth = depth
    ? { label: depth.label, medianM: Math.round(depth.medianM) }
    : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
      <Link
        href="/feed"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted hover:text-teal-600"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to the feed
      </Link>

      <header className="mb-5 mt-3">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
          {prettify(traits.shapeClass)}
        </p>
        <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">{traits.commonName}</h1>
        <p className="mt-0.5 text-sm italic text-navy-900/80">{scientificName}</p>
      </header>

      {/* Shared species content — identical to the rung guide (which only adds a
          "This is my pick" button around the very same component). */}
      <SpeciesGuideContent
        scientificName={scientificName}
        commonName={traits.commonName}
        fieldNote={traits.fieldNote}
        size={traits.size}
        habitat={traits.habitat}
        behavior={traits.behavior}
        initialDepth={initialDepth}
        initialDistribution={distribution}
      />

      {/* T-29: feed the loop - the most educational surface ends with a way back
          into playing/collecting, not a dead end at "back to feed". */}
      <section className="pebl-surface mt-5 rounded-card p-4 text-center">
        <p className="text-sm text-navy-900/80">
          Name {traits.commonName} in a clip to add it to your collection.
        </p>
        <Link
          href="/feed"
          className="pebl-button-primary mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
        >
          Spot it in the feed
        </Link>
      </section>
      </main>
    </div>
  );
}
