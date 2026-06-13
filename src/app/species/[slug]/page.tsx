import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveSpeciesSlug } from "@/lib/species-slug";
import { getCachedDepth, getCachedDistribution } from "@/lib/biodiversity/species-cache";
import { AnnotatedSpeciesPhoto } from "@/components/AnnotatedSpeciesPhoto";
import { SpeciesGallery } from "@/components/SpeciesGallery";
import { DistributionMap } from "@/components/species/DistributionMap";

// Daily ISR: the OBIS depth/distribution fetches are cached per species for a
// day (a dedicated cache table comes with the pokedex schema work).
export const revalidate = 86400;

function prettify(v: string): string {
  const s = v.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function prettyList(vs: string[]): string {
  return vs.length ? vs.map(prettify).join(", ") : "Not recorded";
}
const SIZE_LABEL: Record<string, string> = {
  small: "Small (under 10 cm)",
  medium: "Medium (10-50 cm)",
  large: "Large (over 50 cm)",
};

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-modal bg-surface-muted px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-navy-900/70">{label}</p>
      <p className="mt-0.5 text-sm leading-snug text-navy-900">{value}</p>
    </div>
  );
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

  // Server-side, in parallel: do we have authored marks (gate the "how to spot
  // it" section), and the OBIS depth + distribution (ISR-cached, fail-soft).
  const [markCount, depth, distribution] = await Promise.all([
    prisma.diagnosticMark.count({ where: { scientificName } }),
    getCachedDepth(scientificName),
    getCachedDistribution(scientificName),
  ]);

  const depthValue = depth ? `${depth.label} (median ${Math.round(depth.medianM)} m)` : "Not recorded";

  return (
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

      <header className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
          {prettify(traits.shapeClass)}
        </p>
        <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">{traits.commonName}</h1>
        <p className="mt-0.5 text-sm italic text-navy-900/80">{scientificName}</p>
      </header>

      {/* How to spot it: annotated reference (renders only when marks exist). */}
      {markCount > 0 && (
        <section className="mt-5 rounded-card bg-navy-900 p-4">
          <h2 className="mb-3 font-brand-heading text-h3 text-white">How to spot it</h2>
          <AnnotatedSpeciesPhoto scientificName={scientificName} commonName={traits.commonName} />
        </section>
      )}

      {/* Field note */}
      <section className="pebl-surface mt-5 rounded-card p-4">
        <p className="text-sm leading-7 text-navy-900/85">{traits.fieldNote}</p>
      </section>

      {/* Field facts */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <Fact label="Usually seen at" value={depthValue} />
        <Fact label="Size" value={SIZE_LABEL[traits.size] ?? prettify(traits.size)} />
        <Fact label="Habitat" value={prettyList(traits.habitat)} />
        <Fact label="Behaviour" value={prettyList(traits.behavior)} />
      </section>

      {/* Where it's seen */}
      <section className="pebl-surface mt-5 rounded-card p-4">
        <h2 className="font-brand-heading text-h3 text-navy-900">Where it&apos;s seen</h2>
        <p className="mb-3 mt-0.5 text-xs text-navy-900/60">
          Occurrence records around the UK and north-east Atlantic (OBIS).
        </p>
        <DistributionMap grid={distribution} />
      </section>

      {/* Photos */}
      <section className="pebl-surface mt-5 rounded-card p-4">
        <h2 className="mb-3 font-brand-heading text-h3 text-navy-900">Photos</h2>
        <SpeciesGallery scientificName={scientificName} commonName={traits.commonName} size="thumb" />
      </section>
    </main>
  );
}
