import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { SpeciesAnnotator, type AnnotatorPhoto, type AnnotatorMark } from "./SpeciesAnnotator";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

export default async function AdminSpeciesEditorPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const scientificName = decodeURIComponent(name);
  const traits = CATALOGUE[scientificName];
  if (!traits) notFound();

  const [photoRows, markRows] = await Promise.all([
    prisma.speciesImage.findMany({
      where: { scientificName },
      orderBy: [{ curated: "desc" }, { ordering: "asc" }, { createdAt: "asc" }],
      take: 12,
    }),
    prisma.diagnosticMark.findMany({
      where: { scientificName },
      orderBy: { order: "asc" },
    }),
  ]);

  // Q3A-T4: diagnostic marks only attach to curated reference photos.
  // The annotator should only show curated photos so admins can't even
  // try to author on a stock iNat shot. Non-curated photos remain
  // available in the wider SpeciesGallery as supporting context.
  const curatedRows = photoRows.filter((p) => p.curated);
  const photos: AnnotatorPhoto[] = curatedRows.map((p) => ({
    id: p.id,
    url: p.url,
    thumbUrl: p.thumbUrl,
    attribution: p.attribution,
    width: p.width,
    height: p.height,
  }));

  const marks: AnnotatorMark[] = markRows.map((m) => ({
    id: m.id,
    speciesImageId: m.speciesImageId,
    order: m.order,
    label: m.label,
    description: m.description,
    overlayX: m.overlayX,
    overlayY: m.overlayY,
    overlayRadius: m.overlayRadius,
  }));

  return (
    <div className="space-y-5">
      <div className="text-[12px] text-navy-600">
        <Link href="/admin/species" className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-hover">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M9.5 6h-6M6 3L3 6l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All species
        </Link>
      </div>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-brand text-h2 text-navy-900">{traits.commonName}</h1>
          <p className="pt-1 text-sm italic text-navy-600">{scientificName}</p>
        </div>
        <div className="text-right text-[11px] text-navy-600">
          <div>
            {marks.length} {marks.length === 1 ? "mark" : "marks"} authored
          </div>
          <div>{photos.length} reference photos available</div>
        </div>
      </header>

      {photos.length === 0 ? (
        photoRows.length === 0 ? (
          <div className="rounded-card border border-dashed border-navy-300 bg-white p-6 text-center text-sm text-navy-600">
            <p className="font-medium text-navy-900">No reference photos cached for this species yet.</p>
            <p className="pt-1 text-[12px]">
              Run <code className="rounded bg-navy-100 px-1 py-0.5">npm run db:refresh-images -- --species &quot;{scientificName}&quot;</code> to
              populate the iNaturalist cache, then come back.
            </p>
          </div>
        ) : (
          // Q3A-T4: there ARE photos but none are curated, so we won't let
          // marks be authored. Explain the gate and how to lift it.
          <div className="rounded-card border border-dashed border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
            <p className="font-medium">No curated reference photo for this species.</p>
            <p className="pt-1 text-[12px] leading-relaxed">
              {photoRows.length} iNaturalist photo{photoRows.length === 1 ? " is" : "s are"} cached but
              none are flagged <code className="rounded bg-amber-100 px-1 py-0.5">curated: true</code>.
              Diagnostic marks only render on curated photos, so authoring is blocked here until a
              canonical reference shot is added.
            </p>
            <p className="pt-2 text-[12px] leading-relaxed">
              To unblock: pick a clean single-specimen lateral photo of this species (your own field
              photo, or a clearly-licensed Wikimedia / iNat shot), add it under the
              <code className="rounded bg-amber-100 px-1 py-0.5"> overrides </code> block in
              <code className="rounded bg-amber-100 px-1 py-0.5"> src/data/species-images.json </code>
              with <code className="rounded bg-amber-100 px-1 py-0.5">curated: true</code>, then run
              <code className="rounded bg-amber-100 px-1 py-0.5"> npm run db:refresh-images -- --species &quot;{scientificName}&quot;</code>.
            </p>
          </div>
        )
      ) : (
        <SpeciesAnnotator scientificName={scientificName} photos={photos} initialMarks={marks} />
      )}

      <details className="rounded-modal border border-navy-200 bg-white p-4 text-[12px] text-navy-700">
        <summary className="cursor-pointer font-medium text-navy-900">Current field note + traits (read-only)</summary>
        <p className="pt-2 pb-3 text-[12px] leading-relaxed">
          <span className="font-medium">Field note:</span> {traits.fieldNote}
        </p>
        <pre className="overflow-x-auto text-[11px] leading-relaxed">
          {JSON.stringify({ ...traits, fieldNote: undefined }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
