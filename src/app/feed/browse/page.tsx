import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { ArchiveFilterBar } from "@/components/archive/ArchiveFilterBar";
import { ShareSelectionButton } from "@/components/archive/ShareSelectionButton";
import { loadSpeciesIndex } from "@/lib/snippet-species";
import { siteOptionsInScope, speciesOptionsInScope } from "@/lib/archive-facets";
import { archiveUrl, clipUrl, feedUrlForFilter } from "@/lib/archive-url";
import {
  describeSnippetFilter,
  hasSnippetFilter,
  parseSnippetFilter,
  resolveSpeciesFilter,
  snippetFilterWhere,
  type SnippetFilter,
} from "@/lib/snippet-filter";
import { archiveOrderBy, parseArchiveSort } from "@/lib/archive-query";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { siteLabel } from "@/lib/site-label";

// P-18: answered-pill requires session, dynamic when signed in,
// ISR-cached for anonymous. Next.js bypasses the ISR cache when it
// detects a session cookie read inside getServerSession, so signed-in
// requests are always fresh. Anonymous requests still get 60s ISR.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Video archive",
};

const PAGE_SIZE = 24;

type SnippetRow = {
  id: string;
  thumbnailUrl: string;
  site: string;
  deployment: string;
  depthM: number | null;
  recordingDatetime: string | null;
};

/** What the share sheet says about a selection. */
function shareCopy(filter: SnippetFilter, speciesName: string | undefined, clips: number) {
  const noun = `${clips} clip${clips === 1 ? "" : "s"}`;
  const place = filter.site ? siteLabel(filter.site) : undefined;
  const who = speciesName ? ` the FishSpotter community has identified as ${speciesName}` : "";
  const from = place ? ` from ${place}` : filter.q ? ` matching "${filter.q}"` : "";
  return {
    title: `${[speciesName, place].filter(Boolean).join(" at ") || filter.q}: ${noun} on FishSpotter`,
    text: `Watch ${noun}${who}${from} on FishSpotter.`,
  };
}

export default async function FeedBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Two halves, two owners. The clip-narrowing half (site / species / q) is
  // parsed by @/lib/snippet-filter, which the live feed shares so "Launch feed
  // of current filtered videos" lands on the same set. The order/window half is
  // parsed by @/lib/archive-query, which the feed a CARD opens into shares so
  // "the next clip" is the next one in this grid. Both parse per field, so the
  // blank controls a GET form submits alongside a real choice cannot cancel it.
  const params = parseArchiveSort(raw);
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;

  const [session, speciesIndex] = await Promise.all([
    getServerSession(authOptions),
    // Which species a clip holds is the community's settled ID, not
    // staffAnswer (which is shape words). See @/lib/snippet-species.
    loadSpeciesIndex(prisma),
  ]);
  const myUserId = session?.user?.id ?? null;

  // Build the filter where-clause from validated params. A species slug the
  // index no longer knows is dropped rather than emptying the grid.
  const filter = resolveSpeciesFilter(parseSnippetFilter(raw), speciesIndex);
  const where = snippetFilterWhere(filter, speciesIndex);

  // Each dropdown is counted under the OTHER filter (see @/lib/archive-facets),
  // by running the shared where-clause with that one field relaxed.
  const { site: _site, ...withoutSite } = filter;
  const { species: _species, ...withoutSpecies } = filter;

  const orderBy = archiveOrderBy(sort);

  const [snippets, totalCount, archiveCount, siteRows, inScopeRows] = await Promise.all([
    prisma.snippet.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        thumbnailUrl: true,
        site: true,
        deployment: true,
        depthM: true,
        recordingDatetime: true,
      },
    }),
    prisma.snippet.count({ where }),
    // The whole visible archive, so a filtered count can say "7 of 143".
    prisma.snippet.count({ where: excludeBlockedSnippetsWhere() }),
    prisma.snippet.groupBy({
      by: ["site"],
      where: snippetFilterWhere(withoutSite, speciesIndex),
      _count: { _all: true },
    }),
    prisma.snippet.findMany({
      where: snippetFilterWhere(withoutSpecies, speciesIndex),
      select: { id: true },
    }),
  ]);

  // Each location is offered by its farm's name first ("Câr-y-Môr · Ramsey
  // Sound…"), and the list is ordered by that label so it reads as a list of
  // farms; the option's VALUE stays the site string the filter runs on.
  const siteOptions = siteOptionsInScope(
    siteRows.map((r) => ({ site: r.site, clips: r._count._all })),
    filter.site,
  )
    .map((o) => ({ ...o, label: siteLabel(o.site) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const speciesOptions = speciesOptionsInScope(
    speciesIndex,
    new Set(inScopeRows.map((r) => r.id)),
    filter.species,
  );

  // P-18: build a Set of snippet IDs the current user has answered so
  // the card grid can show an "Answered" badge. One extra query only
  // when signed in; anonymous users see no badges (no session, no cost).
  const answeredSnippetIds = new Set<string>();
  if (myUserId && snippets.length > 0) {
    const snippetIds = snippets.map((s: SnippetRow) => s.id);
    const answers = await prisma.answer.findMany({
      where: { userId: myUserId, snippetId: { in: snippetIds } },
      select: { snippetId: true },
    });
    for (const a of answers) answeredSnippetIds.add(a.snippetId);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const filtered = hasSnippetFilter(filter);
  const speciesName = filter.species
    ? speciesIndex.optionBySlug.get(filter.species)?.commonName
    : undefined;
  const share = shareCopy(filter, speciesName, totalCount);

  return (
    <MarineBackdrop>
    <div className="relative flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8"
      >
        <h1 className="font-brand-heading text-3xl font-bold text-navy-900">
          Video archive
        </h1>

        {/* Filter / sort row. Keyed on the URL so that a change the reader did
            not make through the row itself (Reset, the back button, a shared
            link) remounts the controls on what the URL says. */}
        <ArchiveFilterBar
          key={archiveUrl(filter, { sort })}
          filter={filter}
          sort={sort}
          speciesOptions={speciesOptions}
          siteOptions={siteOptions}
        />

        {/* Take the clips you can see into the live feed. Only offered when
            there is something to watch, so it can never open an empty feed. */}
        <div className="-mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {totalCount > 0 && (
              <Link
                href={feedUrlForFilter(filter)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-navy-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 2.2l8.4 4.8L3 11.8V2.2z" fill="currentColor" />
                </svg>
                {filtered
                  ? "Launch feed of current filtered videos"
                  : `Launch feed of all ${totalCount} videos`}
              </Link>
            )}
            {filtered && totalCount > 0 && (
              <ShareSelectionButton
                path={archiveUrl(filter)}
                title={share.title}
                text={share.text}
              />
            )}
            <p className="text-xs text-navy-900/55" data-testid="archive-count">
              {filtered ? (
                <>
                  <span className="font-semibold text-navy-900/80">
                    {totalCount} of {archiveCount}
                  </span>{" "}
                  clips match
                </>
              ) : (
                <>
                  {archiveCount} clip{archiveCount === 1 ? "" : "s"} in the archive
                </>
              )}
            </p>
          </div>
          {/* The species is the crowd's call, not a label PEBL put on the clip,
              and a reader deciding whether to trust the selection should know
              that before they share it. */}
          {speciesName && (
            <p className="text-xs text-navy-900/55">
              Showing clips the FishSpotter community has identified as {speciesName}
              {filter.site ? ` at ${siteLabel(filter.site)}` : ""}. The list grows as more people play.
            </p>
          )}
          {filtered && (
            <p className="sr-only" role="status">
              Showing {describeSnippetFilter(filter, speciesIndex).join(", ")}: {totalCount} of {archiveCount} clips.
            </p>
          )}
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snippets.map((s: SnippetRow) => (
            <li key={s.id}>
              <Link
                href={clipUrl(s.id, filter, sort)}
                aria-label={`Open clip from ${siteLabel(s.site)}, ${s.deployment}`}
                className="group block"
              >
                <div className="relative aspect-video overflow-hidden rounded-card bg-navy-900/5">
                  <Image
                    src={s.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* P-18: answered-state badge, signed-in only. */}
                  {myUserId && (
                    <span
                      className={
                        "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                        (answeredSnippetIds.has(s.id)
                          ? "bg-teal-500/90 text-navy-900"
                          : "bg-black/60 text-white backdrop-blur-sm")
                      }
                    >
                      {answeredSnippetIds.has(s.id) ? (
                        <>
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                            <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Answered
                        </>
                      ) : (
                        "Open"
                      )}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-0.5 px-0.5">
                  <p className="truncate text-sm font-semibold text-navy-900">
                    {siteLabel(s.site)}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-navy-900/55">
                    {s.recordingDatetime && (
                      <span>
                        {new Date(s.recordingDatetime).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {s.depthM != null && (
                      <span className="text-teal-700">{Math.round(s.depthM)} m deep</span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {snippets.length === 0 && totalCount === 0 && (
          <p className="text-sm text-navy-900/55">
            No clips match.{" "}
            <Link href="/feed/browse" className="text-teal-700 underline">
              Clear filters
            </Link>
          </p>
        )}

        {/* S4-08 pagination */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between text-sm"
            aria-label="Pagination"
          >
            <Link
              href={archiveUrl(filter, { sort, page: Math.max(1, page - 1) })}
              aria-disabled={page === 1}
              className={
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/70 px-4 text-xs font-semibold text-navy-900 transition-colors hover:bg-white " +
                (page === 1 ? "pointer-events-none opacity-40" : "")
              }
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M9.5 6h-6M6 3L3 6l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Previous
            </Link>
            <span className="text-xs text-navy-900/55">
              Page {page} of {totalPages}
            </span>
            <Link
              href={archiveUrl(filter, { sort, page: Math.min(totalPages, page + 1) })}
              aria-disabled={page === totalPages}
              className={
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/70 px-4 text-xs font-semibold text-navy-900 transition-colors hover:bg-white " +
                (page === totalPages ? "pointer-events-none opacity-40" : "")
              }
            >
              Next
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </nav>
        )}
      </main>
    </div>
    </MarineBackdrop>
  );
}
