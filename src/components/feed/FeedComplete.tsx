"use client";

/**
 * End-of-feed card (2026-08-13).
 *
 * Shown as a final feed section once a spotter has identified every clip the
 * feed serves. It exists because finishing the feed was previously
 * indistinguishable from a crash: FeedCard only renders the quiz when the
 * viewer has no answer for that clip, so a spotter with nothing left saw a
 * reveal on every card, no vote button anywhere, and no explanation. The app's
 * top spotter reported it as "I suddenly stopped being able to vote".
 *
 * So this card has two jobs: confirm loudly that they finished (it is an
 * achievement, not a dead end), and capture the one thing that brings them
 * back, an opt-in for when new footage lands.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TRANSITION, spring } from "@/lib/motion";

export interface FeedCompleteProps {
  /** How many clips the spotter has identified (= every clip the feed serves). */
  totalClips: number;
  /** Their running Pebble total, for the "look what you did" line. */
  pebbles: number;
  /** Current state of User.newClipsOptIn. */
  notifyOptIn: boolean;
  /**
   * Whether an email can actually be delivered: verified address, real account.
   * When false the opt-in would silently never fire, so we ask them to verify
   * instead of showing a checkbox that does nothing.
   */
  canReceiveEmail: boolean;
}

export function FeedComplete({
  totalClips,
  pebbles,
  notifyOptIn,
  canReceiveEmail,
}: FeedCompleteProps) {
  const reduceMotion = useReducedMotion();
  const [optIn, setOptIn] = useState(notifyOptIn);
  const [saving, setSaving] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "sending" | "sent" | "rate-limited"
  >("idle");

  const toggle = async (next: boolean) => {
    setOptIn(next);
    setSaving(true);
    try {
      await fetch("/api/account/new-clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newClipsOptIn: next }),
      });
    } catch {
      // Revert so the control never claims a preference the server didn't take.
      setOptIn(!next);
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    setVerifyStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-request", { method: "POST" });
      if (res.status === 429) {
        setVerifyStatus("rate-limited");
        return;
      }
      setVerifyStatus(res.ok ? "sent" : "idle");
    } catch {
      setVerifyStatus("idle");
    }
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : TRANSITION.standard}
        className="pebl-surface my-auto w-full max-w-sm rounded-card p-6 text-center"
      >
        <motion.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : spring.cheer}
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/12 text-teal-600"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 13.5l5 5L20 6" />
          </svg>
        </motion.span>

        <p className="pebl-eyebrow mt-4">Every clip identified</p>
        <h2 className="mt-2 font-brand-heading text-h3 text-navy-900">
          You&apos;ve cleared the board
        </h2>
        <p className="mt-2 text-sm text-navy-900/72">
          That is all {totalClips} clips on the feed, and{" "}
          <strong className="text-navy-900">{pebbles.toLocaleString()}</strong>{" "}
          Pebbles earned. Nothing is broken. You have genuinely run out of
          footage.
        </p>
        <p className="mt-2 text-sm text-navy-900/72">
          More is filmed on every deployment. Scroll back to revisit any clip, or
          have us tell you the moment new footage lands.
        </p>

        {canReceiveEmail ? (
          <label className="mt-5 flex min-h-[44px] items-start gap-3 rounded-modal border border-teal-500/30 bg-teal-500/5 p-3 text-left text-sm">
            <input
              type="checkbox"
              checked={optIn}
              disabled={saving}
              onChange={(e) => toggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-navy-900/20"
            />
            <span>
              <span className="block font-medium text-navy-900">
                Email me when new clips are added
              </span>
              <span className="block text-xs text-navy-900/55">
                {optIn
                  ? "You're on the list. Change this any time in account settings."
                  : "Only when there is something new. Unsubscribe in one click."}
              </span>
            </span>
          </label>
        ) : (
          <div className="mt-5 rounded-modal border border-warn/30 bg-warn/5 p-3 text-left text-xs text-navy-900">
            <p className="font-medium">Want to know when new clips land?</p>
            <p className="mt-1 text-navy-900/72">
              Verify your email address and we&apos;ll tell you the day new
              footage is added.
            </p>
            <button
              type="button"
              onClick={resendVerification}
              disabled={verifyStatus === "sending" || verifyStatus === "sent"}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-full border border-navy-900/20 px-4 text-xs font-semibold hover:border-teal-500 disabled:opacity-60"
            >
              {verifyStatus === "sent"
                ? "Check your inbox"
                : verifyStatus === "rate-limited"
                  ? "Try again later"
                  : verifyStatus === "sending"
                    ? "Sending…"
                    : "Send verification email"}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <a
            href="/pebbles"
            className="pebl-button-primary inline-flex min-h-[44px] items-center justify-center px-5 text-sm"
          >
            See where you rank
          </a>
          <a
            href="/feed/browse"
            className="pebl-button-secondary inline-flex min-h-[44px] items-center justify-center px-5 text-sm"
          >
            Browse the archive
          </a>
        </div>
      </motion.div>
    </div>
  );
}
