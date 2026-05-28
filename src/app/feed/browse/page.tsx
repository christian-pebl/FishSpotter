import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// P-18: answered-pill requires session, dynamic when signed in,
// ISR-cached for anonymous. Next.js bypasses the ISR cache when it
// detects a session cookie read inside getServerSession, so signed-in
// requests are always fresh. Anonymous requests still get 60s ISR.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Archive",
};

const PAGE_SIZE = 24;

// S4-07: Zod schema validates the search-params surface server-side
// so a malformed URL falls back to the default view instead of
// breaking the query.
const SearchSchema = z.object({
  site: z.string().min(1).max(60).optional(),
  q: z.string().min(1).max(60).optional(),
  sort: z.enum(["newest", "oldest", "site"]).optional(),
  page: z.coerce.number().int().min(1).max(999).optional(),
});

type SnippetRow = {
  id: string;
  thumbnailUrl: string;
  site: string;
  deployment: string;
  recordingDatetime: string | null;
};

export default async function FeedBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = SearchSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : {};
  const sort = params.sort ?? "newest";
  const page = params.page ?? 1;

  // Build the filter where-clause from validated params.
  const where: Prisma.SnippetWhereInput = {};
  if (params.site) where.site = params.site;
  if (params.q) {
    where.OR = [
      { site: { contains: params.q, mode: "insensitive" } },
      { deployment: { contains: params.q, mode: "insensitive" } },
      { staffAnswer: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.SnippetOrderByWithRelationInput =
    sort === "oldest"
      ? { createdAt: "asc" }
      : sort === "site"
        ? { site: "asc" }
        : { createdAt: "desc" };

  const session = await getServerSession(authOptions);
  const myUserId = session?.user?.id ?? null;

  const [snippets, totalCount, distinctSites] = await Promise.all([
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
        recordingDatetime: true,
      },
    }),
    prisma.snippet.count({ where }),
    // Distinct site list for the filter chip row. Caps at 50 to keep
    // the chip strip manageable.
    prisma.snippet.findMany({
      distinct: ["site"],
      select: { site: true },
      orderBy: { site: "asc" },
      take: 50,
    }),
  ]);

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

  // Helper to build the next / prev page URL while preserving filters.
  function pageUrl(targetPage: number): string {
    const qs = new URLSearchParams();
    if (params.site) qs.set("site", params.site);
    if (params.q) qs.set("q", params.q);
    if (sort !== "newest") qs.set("sort", sort);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const q = qs.toString();
    return q ? `/feed/browse?${q}` : "/feed/browse";
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8"
      >
        <div className="pebl-surface rounded-hero px-6 py-6">
          <p className="pebl-eyebrow text-xs">Observation archive</p>
          <h1 className="mt-2 font-brand-heading text-3xl font-bold text-navy-900">
            Browse the wider PEBL clip library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-navy-900">
            Review archived sightings from marine monitoring deployments, open any clip, and add your identification to the community record.
          </p>
        </div>

        {/* S4-07 filter / sort row */}
        <form
          method="get"
          className="pebl-surface flex flex-wrap items-end gap-3 rounded-card px-4 py-3"
          aria-label="Filter clips"
        >
          <label className="flex flex-col text-xs text-navy-900/72">
            Search
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Species, site, deployment"
              className="mt-1 rounded-modal border border-navy-900/15 bg-white px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-navy-900/72">
            Site
            <select
              name="site"
              defaultValue={params.site ?? ""}
              className="mt-1 rounded-modal border border-navy-900/15 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All sites</option>
              {distinctSites.map((s: { site: string }) => (
                <option key={s.site} value={s.site}>
                  {s.site}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-navy-900/72">
            Sort
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1 rounded-modal border border-navy-900/15 bg-white px-3 py-1.5 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="site">Site (A-Z)</option>
            </select>
          </label>
          <button
            type="submit"
            className="pebl-button-primary px-3 py-1.5 text-xs"
          >
            Apply
          </button>
          <Link
            href="/feed/browse"
            className="text-xs text-navy-900/55 underline"
          >
            Reset
          </Link>
        </form>

        {/* S4-07 results count + S4-10 end-of-results clarity */}
        <p
          className="text-xs text-navy-900/55"
          aria-live="polite"
        >
          {totalCount === 0
            ? "No clips match your filters."
            : `${totalCount} clip${totalCount === 1 ? "" : "s"}${params.site ? ` at ${params.site}` : ""}${params.q ? ` matching "${params.q}"` : ""}`}
        </p>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snippets.map((s: SnippetRow) => (
            <li key={s.id}>
              <Link
                href={`/feed/${s.id}`}
                aria-label={`Open clip from ${s.site}, ${s.deployment}`}
                className="pebl-surface block overflow-hidden rounded-card transition hover:-translate-y-0.5 hover:border-teal-500"
              >
                <div className="relative aspect-video bg-surface-muted">
                  <Image
                    src={s.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* P-18: answered-state badge. Only shown when signed in
                      (myUserId truthy). Answered clips get a teal pill so
                      spotters can quickly see what's still open. */}
                  {myUserId && (
                    <span
                      className={
                        "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                        (answeredSnippetIds.has(s.id)
                          ? "bg-teal-500/90 text-navy-900"
                          : "bg-black/45 text-white/80 backdrop-blur-sm")
                      }
                    >
                      {answeredSnippetIds.has(s.id) ? "✓ Answered" : "Open"}
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <p className="pebl-eyebrow truncate text-[11px]">{s.deployment}</p>
                  <p className="truncate text-base font-semibold text-navy-900">
                    {s.site}
                  </p>
                  {s.recordingDatetime && (
                    <p className="text-xs text-navy-900/55">
                      {new Date(s.recordingDatetime).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {snippets.length === 0 && totalCount === 0 && (
          <p className="text-sm text-navy-900/55">
            Try a wider filter, or{" "}
            <Link href="/feed/browse" className="text-teal-700 underline">
              clear all filters
            </Link>
            .
          </p>
        )}

        {/* S4-08 pagination */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between text-sm"
            aria-label="Pagination"
          >
            <Link
              href={pageUrl(Math.max(1, page - 1))}
              aria-disabled={page === 1}
              className={
                "pebl-button-secondary px-3 py-1.5 text-xs " +
                (page === 1 ? "pointer-events-none opacity-50" : "")
              }
            >
              ← Previous
            </Link>
            <span className="text-xs text-navy-900/55">
              Page {page} of {totalPages}
            </span>
            <Link
              href={pageUrl(Math.min(totalPages, page + 1))}
              aria-disabled={page === totalPages}
              className={
                "pebl-button-secondary px-3 py-1.5 text-xs " +
                (page === totalPages ? "pointer-events-none opacity-50" : "")
              }
            >
              Next →
            </Link>
          </nav>
        )}
      </main>
    </div>
  );
}
