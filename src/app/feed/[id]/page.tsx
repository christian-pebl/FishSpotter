import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeedPlayer } from "@/components/FeedPlayer";
import { VerificationBanner } from "@/components/VerificationBanner";
import { GuestGate } from "@/components/guest/GuestGate";
import { GuestSavePrompt } from "@/components/guest/GuestSavePrompt";
import { safeParseJson } from "@/lib/safe-json";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import {
  archiveOrderBy,
  archiveWhere,
  parseArchiveSearch,
  rotateToClip,
} from "@/lib/archive-query";

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
 * the archive follows behind it (src/lib/archive-query.ts). Answer, and the next
 * archive clip is already loaded underneath.
 *
 * The URL is unchanged, so shared links, the sitemap and the profile's
 * "recent identifications" list all still land on the right clip. The site/q/sort
 * the archive was filtered by ride along as search params, so a walk that starts
 * inside "Ramsey Sound" stays inside it. The admin "who answered what" panel that
 * used to sit under the player is not carried over: it never belonged on a public
 * page, and /admin/snippets/[id] renders the same component.
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
} as const;

export default async function SnippetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawSearch] = await Promise.all([params, searchParams]);
  const archiveParams = parseArchiveSearch(rawSearch);

  const [filtered, session] = await Promise.all([
    prisma.snippet.findMany({
      where: archiveWhere(archiveParams),
      orderBy: archiveOrderBy(archiveParams.sort),
      select: FEED_SELECT,
    }),
    getServerSession(authOptions),
  ]);

  // The clip can be missing from the filtered list without being missing from
  // the archive: a shared link carries no filters, but one pasted from a
  // filtered grid does, and a species search that matched the PAGE need not
  // match this clip. Falling back to the unfiltered archive keeps the link
  // working; only a clip that is genuinely gone (retired or blocklisted) 404s.
  let ordered = rotateToClip(filtered, id);
  if (!ordered) {
    const all = await prisma.snippet.findMany({
      where: excludeBlockedSnippetsWhere(),
      orderBy: archiveOrderBy(archiveParams.sort),
      select: FEED_SELECT,
    });
    ordered = rotateToClip(all, id);
  }
  if (!ordered) notFound();

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
      {/* No end-of-feed card and no new-clip banner here. Both answer "have you
          cleared the feed?", and an archive walk is a different question: it
          starts wherever the spotter tapped and laps the whole archive. */}
      <FeedPlayer snippets={feedSnippets} />
      <VerificationBanner unverified={unverified} />
      <GuestGate />
      <GuestSavePrompt />
    </main>
  );
}
