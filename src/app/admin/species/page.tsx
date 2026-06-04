import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";


// Gadoid pilot (per the v1 scope). Sorts to the top of the list so the
// admin sees the prioritised species first.
//
// Q3A-T3: previously included Merlangius merlangus (whiting) and
// Melanogrammus aeglefinus (haddock), but neither has a trait entry in
// src/data/species-traits.json, so the page never rendered a row for
// them (the list iterates the catalogue) and the pilot was effectively
// 3 species anyway. Dropped from PILOT to match reality. To bring
// either back, add their trait entries to the catalogue first.
const PILOT = new Set<string>([
  "Pollachius pollachius",
  "Trisopterus luscus",
  "Gadus morhua",
]);

export default async function AdminSpeciesListPage() {
  const markCounts = await prisma.diagnosticMark.groupBy({
    by: ["scientificName"],
    _count: { _all: true },
  });
  const countByName = new Map<string, number>(
    markCounts.map((r) => [r.scientificName, r._count._all]),
  );

  const rows = Object.entries(CATALOGUE)
    .map(([scientificName, traits]) => ({
      scientificName,
      commonName: traits.commonName,
      markCount: countByName.get(scientificName) ?? 0,
      isPilot: PILOT.has(scientificName),
    }))
    .sort((a, b) => {
      if (a.isPilot !== b.isPilot) return a.isPilot ? -1 : 1;
      return a.commonName.localeCompare(b.commonName);
    });

  const pilotDone = rows.filter((r) => r.isPilot && r.markCount > 0).length;
  const pilotTotal = rows.filter((r) => r.isPilot).length;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-brand text-h2 text-navy-900">Species catalogue</h1>
          <p className="pt-1 text-sm text-navy-600">
            Add 1-3 diagnostic marks per species: a labelled ring on a reference photo showing the feature a spotter
            should look for. Pilot species (gadoids) are highlighted.
          </p>
        </div>
        <div className="rounded-modal border border-navy-200 bg-white px-3 py-2 text-right text-[11px] text-navy-600">
          <div className="font-semibold text-navy-900">
            {pilotDone}/{pilotTotal} pilot species authored
          </div>
          <div>{rows.length} species total</div>
        </div>
      </header>

      <div className="overflow-hidden rounded-card border border-navy-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-50 text-[11px] uppercase tracking-wider text-navy-600">
            <tr>
              <th className="px-4 py-2.5">Species</th>
              <th className="px-4 py-2.5">Scientific name</th>
              <th className="px-4 py-2.5">Marks</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.scientificName}
                className={`border-t border-navy-100 ${row.isPilot ? "bg-teal-50/30" : ""}`}
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium text-navy-900">{row.commonName}</span>
                  {row.isPilot && (
                    <span className="ml-2 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                      Pilot
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[12px] italic text-navy-600">{row.scientificName}</td>
                <td className="px-4 py-2.5 text-navy-700">{row.markCount}</td>
                <td className="px-4 py-2.5">
                  <StatusPill count={row.markCount} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/species/${encodeURIComponent(row.scientificName)}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-700 hover:text-teal-hover"
                  >
                    {row.markCount === 0 ? "Author" : "Edit"}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2.5 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-navy-900/72">Not started</span>
    );
  }
  if (count < 3) {
    return (
      <span className="rounded-full bg-pending px-2 py-0.5 text-[11px] text-pending-ink">In progress</span>
    );
  }
  return (
    <span className="rounded-full bg-correct px-2 py-0.5 text-[11px] text-correct-ink">Published</span>
  );
}
