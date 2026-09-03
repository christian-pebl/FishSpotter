import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";
import { FeedFilterNotice } from "@/components/FeedFilterNotice";
import { VerificationBanner } from "@/components/VerificationBanner";
import { GuestGate } from "@/components/guest/GuestGate";
import { GuestSavePrompt } from "@/components/guest/GuestSavePrompt";
import { safeParseJson } from "@/lib/safe-json";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { emptySpeciesIndex, loadSpeciesIndex } from "@/lib/snippet-species";
import {
  describeSnippetFilter,
  hasSnippetFilter,
  parseSnippetFilter,
  resolveSpeciesFilter,
  snippetFilterWhere,
} from "@/lib/snippet-filter";
import { archiveOrderBy, parseArchiveSort, rotateToClip } from "@/lib/archive-query";
import { archiveUrl } from "@/lib/archive-url";
import { jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

/**
 * One clip, opened in the live feed.
 *
 * This route used to render a bespoke player: a letterboxed <video> with browser
 * controls, a details card and a type-the-name box, none of which shared code
 * with the feed. It meant the archive led somewhere strictly worse than the app's
 * main surface, and a spotter who answered there landed in a dead end.
 *
 * It now renders the feed itself, ordered so this clip is first and the rest of
 * the archive follows behind it. Answer, and the next archive clip is already
 * loaded underneath.
 *
 * It is the archive's THIRD entry into the feed, after the unfiltered /feed and
 * the grid's "Launch feed of current filtered videos", and it is the only one
 * where ORDER matters as much as the set: the promise is that the next clip is
 * the next one in the grid you tapped. So the set comes from the same
 * @/lib/snippet-filter as the other two, and the order from @/lib/archive-query,
 * which the grid also uses. The card's href carries both.
 *
 * The URL is unchanged, so shared links, the sitemap and the profile's
 * "recent identifications" list all still land on the right clip. The admin
 * "who answered what" panel that used to sit under the player is not carried
 * over: it never belonged on a public page, and /admin/snippets/[id] renders the
 * same component.
 */

/** See INLINE_TRACK_COUNT in ../page.tsx: the opening cards ship their tracking
 *  JSON inline, the rest lazy-load it per card. Same reasoning, same number. */
const INLINE_TRACK_COUNT = 3;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.snippet.findUnique({
    where: { id },
    select: { site: true, deployment: true, thumbnailUrl: true },
  });
  if (!row) return { title: "Sighting" };
  const title = `${row.site} · ${row.deployment}`;
  const description = "Spot the species in this UK marine monitoring clip on PEBL FishSpotter.";
  const images = [row.thumbnailUrl];
  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

const FEED_SELECT = {
  id: true,
  videoUrl: true,
  thumbnailUrl: true,
  site: true,
  deployment: true,
  staffAnswer: true,
  lat: true,
  lon: true,
  depthM: true,
  recordingDatetime: true,
  createdAt: true,
} as const;

export default async function SnippetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);

  const requested = parseSnippetFilter(raw);
  // Same reasoning as /feed: the species index is a grouped query over every
  // Answer row, so only a species filter pays for it. A clip opened from an
  // unfiltered grid (the common case, and every shared link) does not.
  const speciesIndex = requested.species
    ? await loadSpeciesIndex(prisma)
    : emptySpeciesIndex();
  const filter = resolveSpeciesFilter(requested, speciesIndex);
  const sort = parseArchiveSort(raw).sort;

  const [filtered, session] = await Promise.all([
    prisma.snippet.findMany({
      where: snippetFilterWhere(filter, speciesIndex),
      orderBy: archiveOrderBy(sort),
      select: FEED_SELECT,
    }),
    getServerSession(authOptions),
  ]);

  // The clip can be missing from the FILTERED list without being missing from
  // the archive: a shared link carries no filters, but one pasted from a
  // filtered grid does, and a species selection need not include this clip.
  // Falling back to the unfiltered archive keeps the link working; only a clip
  // that is genuinely gone (retired or blocklisted) 404s.
  let ordered = rotateToClip(filtered, id);
  let filterApplies = hasSnippetFilter(filter);
  if (!ordered) {
    const all = await prisma.snippet.findMany({
      where: excludeBlockedSnippetsWhere(),
      orderBy: archiveOrderBy(sort),
      select: FEED_SELECT,
    });
    ordered = rotateToClip(all, id);
    // The notice must describe the list actually served, not the one asked for.
    filterApplies = false;
  }
  if (!ordered) notFound();

  // VideoObject structured data for the clip this URL names (the feed rotates
  // to start on it, so ordered[0] is always it). uploadDate prefers the
  // camera's recording time but falls back to createdAt (always a valid
  // Date) since recordingDatetime is a free-text field that isn't always
  // parseable.
  const heroClip = ordered[0];
  const recordedAt = heroClip.recordingDatetime ? new Date(heroClip.recordingDatetime) : null;
  const uploadDate = recordedAt && !Number.isNaN(recordedAt.getTime()) ? recordedAt : heroClip.createdAt;
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${heroClip.site} · ${heroClip.deployment}`,
    description: "Spot the species in this UK marine monitoring clip on PEBL FishSpotter.",
    thumbnailUrl: [heroClip.thumbnailUrl],
    uploadDate: uploadDate.toISOString(),
    contentUrl: heroClip.videoUrl,
  };

  const inlineIds = ordered.slice(0, INLINE_TRACK_COUNT).map((s) => s.id);
  const inlineTrackRows = inlineIds.length
    ? await prisma.snippet.findMany({
        where: { id: { in: inlineIds } },
        select: { id: true, bboxJson: true, manualTrackJson: true },
      })
    : [];
  const inlineTrackById = new Map(inlineTrackRows.map((r) => [r.id, r]));

  let unverified = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, isGuest: true },
    });
    unverified = !!user && !user.isGuest && !user.emailVerified;
  }

  const feedSnippets = ordered.map((snippet) => {
    const track = inlineTrackById.get(snippet.id);
    return {
      id: snippet.id,
      videoUrl: snippet.videoUrl,
      thumbnailUrl: snippet.thumbnailUrl,
      site: snippet.site,
      deployment: snippet.deployment,
      staffAnswer: snippet.staffAnswer,
      // null is "not loaded yet", not "no track": FeedPlayer fetches it as each
      // card comes into range.
      bboxes: track ? safeParseJson(track.bboxJson) : null,
      manualTrack: track ? safeParseJson(track.manualTrackJson) : null,
      lat: snippet.lat,
      lon: snippet.lon,
      depthM: snippet.depthM,
      recordingDatetime: snippet.recordingDatetime,
    };
  });

  return (
    <main id="main" tabIndex={-1} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(videoJsonLd) }}
      />
      {/* No end-of-feed card and no new-clip banner. Both answer "have you
          cleared the feed?", and an archive walk is a different question: it
          starts wherever the spotter tapped and laps the whole archive. */}
      <FeedPlayer snippets={feedSnippets} />
      <FeedFilterNotice
        parts={filterApplies ? describeSnippetFilter(filter, speciesIndex) : []}
        clips={feedSnippets.length}
        archiveHref={filterApplies ? archiveUrl(filter, { sort }) : undefined}
      />
      <VerificationBanner unverified={unverified} />
      <GuestGate />
      <GuestSavePrompt />
    </main>
  );
}
