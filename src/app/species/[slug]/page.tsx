import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveSpeciesSlug, speciesSlug } from "@/lib/species-slug";
import { loadSpeciesIndex } from "@/lib/snippet-species";
import { archiveUrl } from "@/lib/archive-url";
import { getCachedDistribution } from "@/lib/biodiversity/species-cache";
import { getSpeciesProvenance } from "@/lib/references/payload";
import { getSpeciesDiet } from "@/lib/foodweb/diet";
import { SpeciesGuideContent } from "@/components/species/SpeciesGuideContent";
import { jsonLdScript } from "@/lib/json-ld";

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
  // Search-intent framing (30 Aug 2026): people search "how to identify
  // pollack", not the binomial. The description leads with the same phrase
  // then reuses the sourced field note verbatim (no new claim is invented
  // for the meta tag, see "Grounded species guide" in CLAUDE.md).
  const title = `How to identify ${r.traits.commonName} | UK marine species`;
  const description = `How to identify ${r.traits.commonName}: ${r.traits.fieldNote}`;
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
  const distribution = await getCachedDistribution(scientificName);
  // Provenance is a pure read of committed data, so it server-renders with the
  // page rather than arriving in a second round trip.
  const provenance = getSpeciesProvenance(scientificName);
  const diet = getSpeciesDiet(scientificName);

  // Same curated-photo lookup as generateMetadata's OG image; Article
  // structured data wants an image too, and Google's docs call it out as
  // one of the fields that most helps Article eligibility for rich results.
  const [heroPhoto, speciesIndex] = await Promise.all([
    prisma.speciesImage.findFirst({
      where: { scientificName, curated: true },
      orderBy: { ordering: "asc" },
      select: { url: true, webpUrl: true },
    }),
    // The clips the community has settled on this species, the same index the
    // archive's Species filter is built from, so the link below lands on the
    // same selection a reader could pick there by hand.
    loadSpeciesIndex(prisma),
  ]);
  const archiveSlug = speciesSlug(scientificName);
  const communityClips = speciesIndex.optionBySlug.get(archiveSlug)?.clips ?? 0;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://fishspotter.app").replace(/\/$/, "");
  const pageUrl = `${siteUrl}/species/${slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `How to identify ${traits.commonName} (${scientificName})`,
    description: `How to identify ${traits.commonName}: ${traits.fieldNote}`,
    ...(heroPhoto ? { image: [heroPhoto.webpUrl ?? heroPhoto.url] } : {}),
    mainEntityOfPage: pageUrl,
    about: {
      "@type": "Thing",
      name: traits.commonName,
      alternateName: scientificName,
    },
    publisher: {
      "@type": "Organization",
      name: "PEBL FishSpotter",
      url: siteUrl,
    },
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }}
      />
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

      {/* Shared species content, identical to the rung guide (which only adds a
          "This is my pick" button around the very same component). */}
      <SpeciesGuideContent
        scientificName={scientificName}
        commonName={traits.commonName}
        fieldNote={traits.fieldNote}
        initialDistribution={distribution}
        initialProvenance={provenance}
        diet={diet}
      />

      {/* T-29: feed the loop - the most educational surface ends with a way back
          into playing/collecting, not a dead end at "back to feed". */}
      <section className="pebl-surface mt-5 rounded-card p-4 text-center">
        <p className="text-sm text-navy-900/80">
          Name {traits.commonName} in a clip to add it to your collection.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/feed"
            className="pebl-button-primary inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Spot it in the feed
          </Link>
          {/* Only once the crowd has settled at least one clip: the archive's
              Species filter offers exactly these, so the link never lands on
              an empty grid. */}
          {communityClips > 0 && (
            <Link
              href={archiveUrl({ species: archiveSlug })}
              className="pebl-button-secondary inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              See {communityClips} clip{communityClips === 1 ? "" : "s"} spotters identified as {traits.commonName}
            </Link>
          )}
        </div>
      </section>
      </main>
    </div>
  );
}
