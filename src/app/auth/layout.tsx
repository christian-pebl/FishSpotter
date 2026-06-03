import type { ReactNode } from "react";
import { MarinePattern } from "@/components/MarinePattern";

/**
 * Shared chrome for every /auth route (signin, forgot, reset, verify).
 *
 * F-EMPTY-AUTH-STATES (design audit, 2026-06-02): the auth screens were bare
 * max-w-md cards on a blank viewport, which the project's own rule prohibits.
 * This layers a faint marine-silhouette pattern behind the card so the unused
 * viewport reads as the product, not a framework default. `isolate` makes the
 * wrapper a stacking context so the -z-10 pattern sits behind the page content.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // overflow-hidden clips the oversized (swaying) pattern host.
    // [&_.pebl-surface]:bg-white/80 drops the auth card from 88% to 80% white
    // so the marine water shows faintly through it (frosted-glass feel).
    <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden [&_.pebl-surface]:bg-white/80">
      <MarinePattern animated className="-z-10 text-teal-600/[0.10]" />
      {children}
    </div>
  );
}
