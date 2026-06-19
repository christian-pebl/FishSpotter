/**
 * /feed Suspense fallback. Shown by Next.js WHILE the server fetches snippets,
 * so it never blocks the page: the moment the feed is ready, React swaps it out.
 *
 * Uses the shared SwimLoader (a school of varied marine silhouettes) on EVERY
 * load — including soft navigations like archive → live feed — rather than the
 * old single-fish minimal loader, so the loading screen is consistent across
 * the app.
 */

import { SwimLoader } from "@/components/SwimLoader";

export default function FeedLoading() {
  return <SwimLoader caption="Spotting the reef" label="Loading the live feed" />;
}
