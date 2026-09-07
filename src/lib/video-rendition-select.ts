/**
 * Which video file a feed card actually plays: the 1920x1080 master, or the
 * 720p SD rendition (see `scripts/lib/video-rendition.ts` for how that file
 * is made and why 720p/CRF 20 was the setting chosen).
 *
 * The split is by DEVICE CLASS, not by measuring the rendered player size,
 * and that is deliberate. `isDesktop` is the same `useDocked()` 768px query
 * the split screen already uses (see `src/lib/split-screen.ts`), so this adds
 * no new hook, no new effect, and inherits that hook's first-render
 * correctness (`useSyncExternalStore`): a card never picks the wrong source
 * on its first paint and then swaps, which is exactly the flash class of bug
 * `useDocked` itself was fixed for on 7 Sep 2026.
 *
 * A device-class split also protects the thing this app actually needs
 * protected: identification quality. A 768px+ viewport is where the docked
 * split panel lives, has room for a comfortable zoom, and is the more likely
 * setting for someone doing careful diagnostic-feature work, so it keeps the
 * full master, unconditionally, forever. A narrower viewport gets the SD
 * rendition, but loses nothing it could show anyway: a phone screen has no
 * more physical pixels to paint than 720p covers at typical widths, whatever
 * file it downloads. Zoom on a phone still softens past what the display
 * can resolve at either resolution; SD only moves that ceiling earlier, the
 * same trade-off the zoom control already accepts past 4x on the master.
 *
 * This is a deliberate SIMPLIFICATION of a true adaptive/quality-switch
 * design (swap to the master mid-play once a viewer actually zooms in), which
 * was considered and set aside: a live source swap risks a stutter or a
 * black frame at exactly the moment someone is carefully reading a feature,
 * which could cost the identification task more than the resolution itself.
 * Revisit if desktop bytes ever need trimming too.
 */

export interface RenditionSnippet {
  videoUrl: string;
  videoUrlSd: string | null;
}

export interface RenditionChoice {
  src: string;
  /** True when `src` is the SD rendition, i.e. an error on it should retry
   *  with the master rather than surfacing "this clip didn't load". */
  isSd: boolean;
}

/**
 * `sdFailed`: set once an SD source has already errored for this mount, so a
 * missing or broken rendition (a row generated mid-failure, an object that
 * 404s) falls back to the always-present master rather than ever showing a
 * broken player. The caller resets this to `false` on every fresh mount.
 */
export function chooseVideoSrc(
  snippet: RenditionSnippet,
  { isDesktop, sdFailed }: { isDesktop: boolean; sdFailed: boolean },
): RenditionChoice {
  if (isDesktop || sdFailed || !snippet.videoUrlSd) {
    return { src: snippet.videoUrl, isSd: false };
  }
  return { src: snippet.videoUrlSd, isSd: true };
}
