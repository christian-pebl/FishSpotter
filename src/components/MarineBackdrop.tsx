import type { ReactNode } from "react";
import { MarinePattern } from "@/components/MarinePattern";

/**
 * Page-level decorative backdrop. Tiles the marine-silhouette pattern behind a
 * page and drops every white card (.pebl-surface) inside it to 80% opacity with
 * a faint backdrop-blur, so the pattern shows through them (frosted-glass feel).
 *
 * Layout-neutral by design:
 *  - the wrapper is `display:contents`, so it generates no box and cannot
 *    disturb a page's existing flex / scroll structure (it only carries the
 *    `[&_.pebl-surface]` scoping, which matches descendants regardless of box);
 *  - the pattern is a `fixed`, clipped, `-z-10` layer that paints above the body
 *    gradient but behind the (non-positioned) page content, and stays put while
 *    the page scrolls over it.
 *
 * Used on the non-feed pages (leaderboard, account, profile, legal). The feed
 * has its own underwater video background and must NOT use this. The landing
 * page keeps its bespoke UnderwaterBackdrop. /auth has its own equivalent in
 * auth/layout.tsx.
 */
export function MarineBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ display: "contents" }}
      className="[&_.pebl-surface]:bg-white/80 [&_.pebl-surface]:backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <MarinePattern animated className="text-teal-600/[0.10]" />
      </div>
      {children}
    </div>
  );
}
