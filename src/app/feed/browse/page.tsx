import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { MarineBackdrop } from "@/components/MarineBackdrop";

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
  depthM: number | null;
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
        depthM: true,
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
    <MarineBackdrop>
    <div className="relative flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8"
      >
        <h1 className="font-brand-heading text-3xl font-bold text-navy-900">
          Observation Archive
        </h1>

        {/* Filter / sort row — clean, borderless, species-guide styling. */}
        <form
          method="get"
          className="flex flex-wrap items-center gap-2"
          aria-label="Filter clips"
        >
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search species, site, deployment"
            aria-label="Search clips"
            className="min-w-[12rem] flex-1 rounded-full bg-white/70 px-4 py-2 text-sm text-navy-900 placeholder:text-navy-900/40 focus:bg-white focus:outline-none"
          />
          <select
            name="site"
            defaultValue={params.site ?? ""}
            aria-label="Filter by site"
            className="rounded-full bg-white/70 px-4 py-2 text-sm text-navy-900 focus:bg-white focus:outline-none"
          >
            <option value="">All sites</option>
            {distinctSites.map((s: { site: string }) => (
              <option key={s.site} value={s.site}>
                {s.site}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            aria-label="Sort clips"
            className="rounded-full bg-white/70 px-4 py-2 text-sm text-navy-900 focus:bg-white focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="site">Site (A-Z)</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-teal-400"
          >
            Apply
          </button>
          {(params.q || params.site || sort !== "newest") && (
            <Link
              href="/feed/browse"
              className="px-2 text-xs text-navy-900/55 transition-colors hover:text-navy-900/80"
            >
              Reset
            </Link>
          )}
        </form>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snippets.map((s: SnippetRow) => (
            <li key={s.id}>
              <Link
                href={`/feed/${s.id}`}
                aria-label={`Open clip from ${s.site}, ${s.deployment}`}
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
                    {s.site}
                  </p>
                  <p className="truncate text-[11px] uppercase tracking-wider text-navy-900/45">
                    {s.deployment}
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
              href={pageUrl(Math.max(1, page - 1))}
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
              href={pageUrl(Math.min(totalPages, page + 1))}
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
