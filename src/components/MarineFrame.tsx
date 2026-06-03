import type { ReactNode } from "react";
import { MarinePattern } from "./MarinePattern";

/**
 * Full-area marine-pattern backdrop for standalone / terminal pages (404,
 * error, sighting-not-found) that aren't under the /auth layout. Stops them
 * reading as a bare card centred on a blank viewport (design-audit
 * F-EMPTY-AUTH-STATES); mirrors the treatment in src/app/auth/layout.tsx.
 *
 * No client-only code, so it can be rendered from server pages (404s) and
 * client error boundaries alike. `overflow-hidden` clips the oversized
 * (swaying) pattern host; `isolate` keeps the -z-10 pattern behind content.
 */
export function MarineFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
      <MarinePattern animated className="-z-10 text-teal-600/[0.10]" />
      {children}
    </div>
  );
}
