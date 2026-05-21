"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const STEPS = [
  {
    eyebrow: "1 · Spot",
    title: "Pick the species in 5 seconds",
    body: "Each clip shows a short underwater snippet. We surface a few likely species — pick the one that matches what you see. No typing required.",
  },
  {
    eyebrow: "2 · Compare",
    title: "Compare with the PEBL staff answer",
    body: "After you pick, we reveal the PEBL reference identification, how the wider community guessed, and which species OBIS expects at this location and season.",
  },
  {
    eyebrow: "3 · Streak",
    title: "Build a streak",
    body: "Identify clips on consecutive days to grow a streak. Submit 10 identifications to enter the leaderboard. We'll send one Monday digest a week — opt out any time.",
  },
];

interface Props {
  needsTour: boolean;
}

/**
 * Onboarding tour for first-time signed-in users (S3-11). The parent
 * decides whether the tour should appear (checks User.onboardedAt
 * server-side) and passes `needsTour`. Dismissal POSTs
 * /api/account/onboarding so the flag survives a sessionStorage clear
 * or a second device.
 */
export function OnboardingTour({ needsTour }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(needsTour && !!session?.user);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!needsTour || !session?.user) return;
    setOpen(true);
  }, [needsTour, session?.user]);

  const close = async () => {
    setOpen(false);
    try {
      await fetch("/api/account/onboarding", { method: "POST" });
    } catch {
      // No-op — refreshing the page on a future session sees the
      // same `needsTour=true` and re-prompts.
    }
  };

  if (!open) return null;
  const slide = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="pebl-surface w-full max-w-md rounded-hero p-6 md:p-8">
        <p className="pebl-eyebrow">{slide.eyebrow}</p>
        <h2 className="mt-3 font-brand text-h2 text-navy-900">{slide.title}</h2>
        <p className="mt-3 text-sm leading-6 text-navy-900/72">{slide.body}</p>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 w-6 rounded-full " +
                  (i === step ? "bg-teal-500" : "bg-navy-900/15")
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="pebl-button-secondary px-3 py-1.5 text-xs"
            >
              Skip
            </button>
            {last ? (
              <button
                type="button"
                onClick={close}
                className="pebl-button-primary px-4 py-1.5 text-xs"
              >
                Got it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="pebl-button-primary px-4 py-1.5 text-xs"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
