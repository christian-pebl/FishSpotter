import Link from "next/link";
import { notFound } from "next/navigation";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";

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

  return (
    <div className="space-y-5">
      <div className="text-[12px] text-navy-600">
        <Link href="/admin/species" className="text-teal-700 hover:text-teal-800">
          ← All species
        </Link>
      </div>
      <header>
        <h1 className="font-brand text-h2 text-navy-900">{traits.commonName}</h1>
        <p className="pt-1 text-sm italic text-navy-600">{scientificName}</p>
      </header>
      <div className="rounded-xl border border-dashed border-navy-300 bg-white p-6 text-center text-sm text-navy-600">
        <p className="font-medium text-navy-900">Diagnostic-mark editor coming in PR2.</p>
        <p className="pt-1 text-[12px]">
          This page will let you pick a reference photo, click to add labelled rings (the chin barbel, the pectoral
          blotch, etc.) and edit the field note that surfaces in the wizard&apos;s final reveal.
        </p>
      </div>
      <details className="rounded-lg border border-navy-200 bg-white p-4 text-[12px] text-navy-700">
        <summary className="cursor-pointer font-medium text-navy-900">Current trait data (read-only)</summary>
        <pre className="overflow-x-auto pt-2 text-[11px] leading-relaxed">
          {JSON.stringify(traits, null, 2)}
        </pre>
      </details>
    </div>
  );
}
