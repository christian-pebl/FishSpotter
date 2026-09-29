"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { onPebbles } from "@/lib/pebble-bus";
import { onTour } from "@/lib/tour-bus";
import { GhostCursor } from "./GhostCursor";
import { PebbleHint } from "./PebbleHint";
import { Spotlight } from "./Spotlight";
import { TourCaption } from "./TourCaption";
import { STEP_COUNT, TOUR_STEPS, TUTORIAL_HINTS, stepForSignal } from "./tour-steps";
import { useAnchorRect, useTileCentre } from "./useAnchorRect";

/**
 * First-run tour (S3-11, rebuilt 28 Aug 2026).
 *
 * WHAT CHANGED AND WHY. The old tour was a `max-w-md` modal containing a
 * hand-drawn REPLICA of a feed card: a fake Identify pill, a fake four-chip
 * grid, a fake histogram, a fake streak flame. Because nothing linked that
 * replica to the real components, it drifted: by August it was teaching the
 * retired MCQ fast path rather than the Spot It rung flow, and showing a
 * reference-answer badge that had been removed from the reveal on purpose (the
 * crowd is the authority, there is no answer key). A second copy of the UI will
 * always drift, so it is gone.
 *
 * This is a full-screen SPOTLIGHT over the live app. Everything outside the
 * current target is dimmed, the target is a lit cut-out, a ghost cursor mimes
 * the gesture, and the user makes the real tap on the real control. Every
 * highlighted pixel is shipping UI, so there is nothing left to drift.
 *
 * The tour FOLLOWS the app rather than driving it. Each rung transition emits a
 * signal on the tour bus and the tour jumps to whichever step that signal
 * belongs to (`stepForSignal`). That is what makes divergence safe: a user who
 * picks Fish instead of the suggested Crab, whose shape class has no body-form
 * sub-split, or who takes "skip to guess" straight past three rungs, all land
 * on a coherent step rather than stranding the spotlight on a dead anchor.
 *
 * It ends at the consensus. Pebbles are a non-blocking hint afterwards
 * (`PebbleHint`), so the tutorial is already complete before it appears and
 * nobody has to click it to be done.
 */
export function OnboardingTour({
  needsTour,
  /** Is the pinned tutorial clip (the velvet crab) the card on screen? Only
   *  then may the ghost cursor point at a NAMED tile: pointing at "Crab" over a
   *  clip of a pollack would teach the wrong answer on the first ID. */
  tutorialClipPinned = false,
}: {
  needsTour: boolean;
  tutorialClipPinned?: boolean;
}) {
  const { data: session } = useSession();
  const [phase, setPhase] = useState<"idle" | "tour" | "hint" | "done">("idle");
  const [step, setStep] = useState(0);
  const [earned, setEarned] = useState(0);
  const [forced, setForced] = useState(false);
  const dismissedRef = useRef(false);

  // `?tour=1` forces the tour, for testing and for a deliberate replay. The
  // completion POST is idempotent (it only writes where onboardedAt is null),
  // so a forced replay costs nothing but the clip it spends. Read off
  // `window.location` rather than `useSearchParams`, which would drag a
  // Suspense boundary requirement into the feed page for one debug flag.
  useEffect(() => {
    setForced(new URLSearchParams(window.location.search).get("tour") === "1");
  }, []);

  const wanted = (needsTour || forced) && !!session?.user;

  useEffect(() => {
    if (dismissedRef.current || !wanted) return;
    setPhase("tour");
    // useSession() hands back a new object on every background refetch (e.g.
    // visibilitychange on a tab switch) even when nothing changed, so depending
    // on it would re-open the tour after dismissal. dismissedRef makes the
    // re-arm a one-shot.
  }, [wanted]);

  // The reveal's pebble award, banked so the hint can name a real number.
  useEffect(() => onPebbles(({ earned: n }) => setEarned(n)), []);

  const active = phase === "tour";
  const current = TOUR_STEPS[Math.min(step, STEP_COUNT - 1)];

  // Follow the app. A signal always JUMPS to its step, forwards or back, so a
  // user who taps Back through the rungs is tracked just as faithfully as one
  // who walks forwards.
  useEffect(() => {
    if (!active) return;
    return onTour((signal) => {
      const target = stepForSignal(signal);
      if (target >= 0) setStep(target);
    });
  }, [active]);

  const complete = useCallback(
    async (showHint: boolean) => {
      dismissedRef.current = true;
      setPhase(showHint ? "hint" : "done");
      try {
        await fetch("/api/account/onboarding", { method: "POST" });
      } catch {
        // No-op. A future session sees needsTour=true and re-prompts, which is
        // the right failure: better a repeated tour than a silently lost one.
      }
    },
    [],
  );

  // Escape skips. The caption is not modal (it must not trap focus, or the user
  // could not reach the controls it points at), so this is bound at the window.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void complete(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, complete]);

  const anchors = useMemo(() => current.anchors, [current]);
  const match = useAnchorRect(anchors, active);
  // Only the LAST anchor is the recovery fallback (the clip). Resolving to it
  // on any step past the first means the surface this step describes is gone.
  const recovered =
    !!match && step > 0 && match.key === anchors[anchors.length - 1] && anchors.length > 1;

  const hintTile =
    tutorialClipPinned && current.cursor?.hint ? TUTORIAL_HINTS[current.cursor.hint] : undefined;
  const tileCentre = useTileCentre(hintTile, active && !recovered);

  const cursorPoint = (() => {
    if (!active || recovered || !current.cursor || !match) return null;
    if (tileCentre) return tileCentre;
    const { rect } = match;
    // Scroll mode sits a little above centre so the mimed drag stays inside the
    // scrollable area rather than running off its bottom edge.
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * (current.cursor.mode === "scroll" ? 0.38 : 0.5),
    };
  })();

  const copy = recovered && current.recovery ? current.recovery : current.copy;
  const last = step === STEP_COUNT - 1;

  return (
    <>
      {active && (
        <>
          <Spotlight rect={match?.rect ?? null} />
          <GhostCursor point={cursorPoint} mode={current.cursor?.mode ?? "click"} />
          <TourCaption
            // In recovery the tour is not pointing AT anything, it is telling
            // the user to tap the clip again. Passing no anchor docks the
            // caption to the top of the screen, which matters on a phone: the
            // recovery anchor is the clip, whose lower edge is exactly where
            // the gate sheet sits, so hugging it put the caption on the sheet.
            anchor={recovered ? null : (match?.rect ?? null)}
            eyebrow={copy.eyebrow}
            title={copy.title}
            body={copy.body}
            stepIndex={step}
            stepCount={STEP_COUNT}
            nextLabel={recovered ? null : current.nextLabel}
            onNext={() => void complete(last)}
            onBack={step > 0 ? () => setStep(step - 1) : null}
            onSkip={() => void complete(false)}
          />
        </>
      )}
      {phase === "hint" && <PebbleHint earned={earned} onDismiss={() => setPhase("done")} />}
    </>
  );
}
