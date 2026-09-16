"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { onPebbles } from "@/lib/pebble-bus";
import {
  PRIZE_BLURB,
  PRIZE_FALLBACK_IMAGE,
  PRIZE_GALLERY,
  PRIZE_NAME,
  PRIZE_TARGET_PEBBLES,
} from "@/lib/prize";
import type { PrizeClaimStatus, PrizeRequirement } from "@/lib/prize-requirements";
import { GUEST_SAVED_EVENT, GUEST_SAVE_REQUEST_EVENT } from "@/lib/guest";
import {
  AGE_DECLARED_EVENT,
  PARENT_REQUESTED_EVENT,
  requestAgeCheck,
  requestParentConsent,
  type ParentRequestedDetail,
} from "@/lib/age-events";
import { EASE, TRANSITION } from "@/lib/motion";
import {
  VerificationHelp,
  verificationStatusFromResponse,
  type VerificationSendStatus,
} from "@/components/VerificationHelp";

/** A small outline pebble (matches the Pebble bag glyph). */
function PebbleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Eases toward `value` (instant under reduced motion). */
function AnimatedCount({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduceMotion || from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: EASE.enter,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);
  return <>{display.toLocaleString()}</>;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type GalleryImage = { src: string; alt: string };

/**
 * Probe a slot's candidate sources (jpg then png) with detached Image()
 * objects, resolving to the first that loads or null when none do.
 */
function probeSlot(srcs: readonly string[], alt: string): Promise<GalleryImage | null> {
  return new Promise((resolve) => {
    const tryAt = (i: number) => {
      if (i >= srcs.length) return resolve(null);
      const probe = new window.Image();
      probe.onload = () => resolve({ src: srcs[i], alt });
      probe.onerror = () => tryAt(i + 1);
      probe.src = srcs[i];
    };
    tryAt(0);
  });
}

/**
 * Flick-through gallery of the guide: front cover first, then inside pages.
 * Slots are probed with detached Image() objects in an effect, NOT via
 * onError on the rendered <img>, because with SSR'd markup a fast 404 can
 * fire before hydration attaches React's handler, leaving broken-image
 * icons on screen. Until the probe settles (and whenever nothing loads) the
 * committed PEBL illustration renders, so a missing file is never visible.
 * Shipping real screenshots is just dropping files into public/shop/guide/
 * (see PRIZE_GALLERY).
 */
function PrizeGallery({ reduceMotion }: { reduceMotion: boolean }) {
  const [resolved, setResolved] = useState<GalleryImage[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(PRIZE_GALLERY.map((slot) => probeSlot(slot.srcs, slot.alt))).then(
      (slots) => {
        if (!cancelled) setResolved(slots.filter((s): s is GalleryImage => s !== null));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = resolved?.length ? resolved : [PRIZE_FALLBACK_IMAGE];
  const idx = Math.min(active, visible.length - 1);
  const current = visible[idx];
  const many = visible.length > 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-center justify-center overflow-hidden rounded-modal bg-[color:var(--surface-muted)] p-2">
        <AnimatePresence mode="wait" initial={false}>
          {/* Plain img (not next/image): every rendered src has already been
              probed successfully, and the assets are small local files. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            key={current.src}
            src={current.src}
            alt={current.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : TRANSITION.micro}
            className="h-44 w-full object-contain sm:h-52"
          />
        </AnimatePresence>
        {many && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setActive((idx - 1 + visible.length) % visible.length)}
              className="absolute left-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-900/40 text-white hover:bg-navy-900/60"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setActive((idx + 1) % visible.length)}
              className="absolute right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-900/40 text-white hover:bg-navy-900/60"
            >
              <Chevron dir="right" />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Guide pages">
          {visible.map((img, i) => (
            <button
              key={img.src}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show ${img.alt}`}
              onClick={() => setActive(i)}
              className={`h-14 w-12 shrink-0 overflow-hidden rounded-modal border-2 bg-[color:var(--surface-muted)] transition-colors ${
                i === idx ? "border-teal-500" : "border-transparent hover:border-navy-900/20"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Done is a filled tick, not done an empty ring: the shape carries it, not the colour. */
function StatusMark({ met }: { met: boolean }) {
  return met ? (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-teal-600" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M4.8 8.3l2.1 2.1 4.3-4.6" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-navy-900/40" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function verifyButtonLabel(status: VerificationSendStatus, afterSave: boolean): string {
  switch (status) {
    case "sending":
      return "Sending…";
    case "sent":
      return "Link sent";
    case "rate-limited":
      return "Try again later";
    case "unavailable":
      return "Could not send";
    case "error":
      return "Could not send. Retry";
    default:
      return afterSave ? "Send a confirmation link" : "Send me the link";
  }
}

/**
 * Everything besides the Pebbles (the bar above covers those) that a claim
 * needs, straight from prizeClaimStatus, so a spotter learns the rules while
 * there is still time to meet them. The account row carries its own action.
 */
function ClaimChecklist({
  requirements,
  savedJustNow,
}: {
  requirements: PrizeRequirement[];
  /** A guest saved their account on this page; the server list predates it. */
  savedJustNow: boolean;
}) {
  const [verifyStatus, setVerifyStatus] = useState<VerificationSendStatus>("idle");
  // A parent request made on this page; the server list predates it.
  const [askedJustNow, setAskedJustNow] = useState<{ account: boolean; prize: boolean }>({
    account: false,
    prize: false,
  });
  useEffect(() => {
    const onAsked = (e: Event) => {
      const detail = (e as CustomEvent<ParentRequestedDetail>).detail;
      if (detail?.emailSent) setAskedJustNow((s) => ({ ...s, [detail.purpose]: true }));
    };
    window.addEventListener(PARENT_REQUESTED_EVENT, onAsked);
    return () => window.removeEventListener(PARENT_REQUESTED_EVENT, onAsked);
  }, []);

  const sendVerification = async () => {
    setVerifyStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-request", { method: "POST" });
      setVerifyStatus(verificationStatusFromResponse(res));
    } catch {
      setVerifyStatus("error");
    }
  };

  const rows = requirements
    .filter((r) => r.id !== "pebbles")
    .map((r): PrizeRequirement => {
      if (r.id === "account" && savedJustNow && r.action === "save-account") {
        return {
          ...r,
          label: "Confirm your email address",
          detail:
            "Check your inbox. Setting your password from the link we just sent confirms your address too.",
          action: "verify-email",
        };
      }
      const asked =
        (r.action === "ask-parent-account" && askedJustNow.account) ||
        (r.action === "ask-parent-prize" && askedJustNow.prize);
      return !r.met && asked ? { ...r, detail: PARENT_WAITING_DETAIL } : r;
    });

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-navy-900/55">
        Also needed to claim
      </p>
      <ul className="mt-1.5 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <span className="mt-0.5">
              <StatusMark met={r.met} />
            </span>
            <div className="min-w-0 flex-1 text-xs leading-5">
              <p className={r.met ? "text-navy-900/72" : "font-semibold text-navy-900"}>
                <span className="sr-only">{r.met ? "Done: " : "Still to do: "}</span>
                {r.label}
              </p>
              {r.detail ? <p className="text-navy-900/72">{r.detail}</p> : null}
              {r.action === "declare-age" ? (
                <button
                  type="button"
                  onClick={requestAgeCheck}
                  className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 underline hover:text-navy-900"
                >
                  Tell us your age
                </button>
              ) : null}
              {r.action === "ask-parent-account" || r.action === "ask-parent-prize" ? (
                <button
                  type="button"
                  onClick={() =>
                    requestParentConsent(r.action === "ask-parent-prize" ? "prize" : "account")
                  }
                  className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 underline hover:text-navy-900"
                >
                  {r.detail === PARENT_WAITING_DETAIL ? "Send it again" : "Ask a parent or carer"}
                </button>
              ) : null}
              {r.action === "save-account" ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent(GUEST_SAVE_REQUEST_EVENT))}
                  className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 underline hover:text-navy-900"
                >
                  Add my email
                </button>
              ) : null}
              {r.action === "verify-email" ? (
                <>
                  <button
                    type="button"
                    onClick={sendVerification}
                    disabled={verifyStatus === "sending" || verifyStatus === "sent"}
                    className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 underline hover:text-navy-900 disabled:no-underline disabled:opacity-60"
                  >
                    {verifyButtonLabel(verifyStatus, savedJustNow)}
                  </button>
                  <VerificationHelp status={verifyStatus} showIdleHint={false} />
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Note = { kind: "error" | "success"; text: string };

/** Matches the pending copy in src/lib/prize-requirements.ts. */
const PARENT_WAITING_DETAIL = "We've emailed them. Once they say yes, this ticks itself.";

/**
 * The single goal of the Pebbles page: your progress toward winning the
 * Seasearch guide, and the claim action once you're there. The prize is a
 * gift (claiming deducts nothing); POST /api/prize/claim enforces the target
 * + the anti-gaming eligibility gate server-side. `status` is the same
 * judgement made in advance (src/lib/prize-requirements.ts), shown as a
 * checklist from the first Pebble, so nobody learns a rule at 2,000.
 *
 * Imagery is a flick-through gallery (front cover + inside pages) driven by
 * the PRIZE_GALLERY manifest, drop screenshots into public/shop/guide/ with
 * the manifest filenames and they appear with no code change; until then the
 * committed PEBL illustration stands in.
 */
export function PrizeCard({
  authed,
  initialEarned,
  initiallyClaimed,
  status,
  rulesSummary,
}: {
  authed: boolean;
  initialEarned: number;
  initiallyClaimed: boolean;
  /** Precomputed for anyone signed in, guests included; null when signed out. */
  status: PrizeClaimStatus | null;
  /** prizeRulesSummary(), shown to people who are not signed in. */
  rulesSummary: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [earned, setEarned] = useState(initialEarned);
  const [claimed, setClaimed] = useState(initiallyClaimed);
  const [justClaimed, setJustClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [shake, setShake] = useState(0);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const router = useRouter();
  // Under-18s get their prize through a parent; the checklist says so.
  const viaParent = !!status?.requirements.some((r) => r.id === "parent");

  // Keep the progress live while the page is open (earning in another tab of
  // the same session fires the pebble bus).
  useEffect(
    () => onPebbles(({ earned: delta }) => setEarned((e) => e + delta)),
    [],
  );

  // A guest who saves their account from the checklist moves on to
  // confirming it, without waiting for a reload.
  useEffect(() => {
    const onSaved = () => setSavedJustNow(true);
    window.addEventListener(GUEST_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(GUEST_SAVED_EVENT, onSaved);
  }, []);

  // A newly declared age changes the checklist itself; ask the server again.
  useEffect(() => {
    const onAge = () => router.refresh();
    window.addEventListener(AGE_DECLARED_EVENT, onAge);
    return () => window.removeEventListener(AGE_DECLARED_EVENT, onAge);
  }, [router]);

  const reached = earned >= PRIZE_TARGET_PEBBLES;
  const pct = Math.max(0, Math.min(100, (earned / PRIZE_TARGET_PEBBLES) * 100));
  // With no precomputed status the server is the only judge, so let it answer.
  const gated = reached && !claimed && !!status && !status.eligible;

  async function claim() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/prize/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ukAddress: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setShake((s) => s + 1);
        setNote({ kind: "error", text: data.error ?? "Something went wrong. Try again." });
        return;
      }
      setClaimed(true);
      setJustClaimed(true);
      setNote({
        kind: "success",
        text: viaParent
          ? "Claimed! PEBL will email your parent or carer to arrange delivery."
          : "Claimed! PEBL will email you to arrange delivery.",
      });
    } catch {
      setShake((s) => s + 1);
      setNote({ kind: "error", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION.standard}
      className="pebl-surface rounded-card p-4 shadow-chip sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center">
        <motion.div
          key={justClaimed ? 1 : 0}
          initial={false}
          animate={justClaimed && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, ease: EASE.enter }}
        >
          <PrizeGallery reduceMotion={reduceMotion} />
        </motion.div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-teal-600">
              The prize
            </p>
            <h2 className="mt-1 font-brand text-h3 text-navy-900">Win the {PRIZE_NAME}</h2>
            <p className="mt-1.5 text-sm leading-6 text-navy-900/72">{PRIZE_BLURB}</p>
          </div>

          <motion.div
            key={shake}
            initial={false}
            animate={shake && !reduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-2"
          >
            {authed ? (
              <>
                <div>
                  <div
                    aria-hidden="true"
                    className="h-2 w-full overflow-hidden rounded-full bg-navy-900/10"
                  >
                    <motion.div
                      className="h-full rounded-full bg-teal-500"
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={reduceMotion ? { duration: 0 } : TRANSITION.layout}
                    />
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-navy-900/72">
                    <span className="text-teal-700">
                      <PebbleGlyph size={12} />
                    </span>
                    <span className="tabular-nums">
                      <AnimatedCount value={Math.min(earned, PRIZE_TARGET_PEBBLES)} /> of{" "}
                      {PRIZE_TARGET_PEBBLES.toLocaleString()}
                    </span>
                    {!reached && <span>· keep spotting</span>}
                  </p>
                </div>

                {!claimed && status ? (
                  <ClaimChecklist requirements={status.requirements} savedJustNow={savedJustNow} />
                ) : null}

                {claimed ? (
                  <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-full bg-teal-500/12 px-5 text-sm font-semibold text-teal-700">
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                      <motion.path
                        d="M2 6.5l2.5 2.5L10 3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={justClaimed && !reduceMotion ? { pathLength: 0 } : false}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, ease: EASE.enter, delay: 0.05 }}
                      />
                    </svg>
                    Claimed
                  </span>
                ) : reached ? (
                  <>
                  <motion.button
                    type="button"
                    onClick={claim}
                    disabled={busy || gated}
                    whileTap={reduceMotion || busy || gated ? undefined : { scale: 0.97 }}
                    className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-6 text-sm font-semibold text-white transition-opacity hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? "Claiming…" : "Claim your guide"}
                  </motion.button>
                  {/* Stated where the claim is made (CAP Code 8.17): claiming after
                      reading it is the confirmation the route asks for. */}
                  <p className="text-xs text-navy-900/72">
                    Posted free to UK addresses
                    {viaParent ? ", arranged with your parent or carer" : ""}.{" "}
                    <Link href="/prize-rules" className="underline">
                      Prize rules
                    </Link>
                  </p>
                  </>
                ) : null}

                {gated && status?.trustPending && !note && (
                  <p className="text-xs text-navy-900/72" role="status">
                    Almost there. Claims also need a track record of IDs that other spotters agree
                    with, so keep spotting.
                  </p>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Sign in and start earning
                </Link>
                <p className="text-xs leading-5 text-navy-900/72">
                  {rulesSummary}{" "}
                  <Link href="/prize-rules" className="underline">
                    Prize rules
                  </Link>
                </p>
              </>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {note && (
                <motion.p
                  key={note.text}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={TRANSITION.micro}
                  className={`text-xs ${note.kind === "error" ? "text-danger" : "text-teal-700"}`}
                  role={note.kind === "error" ? "alert" : "status"}
                >
                  {note.text}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
