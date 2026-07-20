"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { emitWallet } from "@/lib/pebble-bus";
import { FSC_GUIDE_ID, type ShopItem } from "@/lib/shop/catalogue";
import { EASE, TRANSITION } from "@/lib/motion";

/** A small outline pebble for the price pill (matches the Pebble bag glyph). */
function PebbleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Eases toward `value` so spends visibly count the wallet down (instant under reduced motion). */
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

/**
 * Prize imagery: prefers a real product photo at /shop/<id>.jpg (drop one in
 * public/shop/ and it's picked up with no code change) and falls back to the
 * committed PEBL illustration at /shop/<id>.svg. `popNonce` bumps replay a
 * small celebratory scale-pop on successful redemption.
 */
function ItemArt({
  item,
  popNonce,
  reduceMotion,
}: {
  item: ShopItem;
  popNonce: number;
  reduceMotion: boolean;
}) {
  const [src, setSrc] = useState(`/shop/${item.id}.jpg`);
  return (
    <motion.div
      key={popNonce}
      initial={false}
      animate={popNonce > 0 && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: EASE.enter }}
      className="flex items-center justify-center overflow-hidden rounded-modal bg-[color:var(--surface-muted)] p-2"
    >
      {/* Plain img (not next/image): the src falls back at runtime via onError,
          and the asset is a small local file. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        onError={() => {
          if (!src.endsWith(".svg")) setSrc(`/shop/${item.id}.svg`);
        }}
        alt={item.id === FSC_GUIDE_ID ? "Fold-out rockpool identification chart" : item.name}
        className="h-44 w-full object-contain sm:h-52"
      />
    </motion.div>
  );
}

/** Progress toward affording an item — turns a disabled redeem button into a goal. */
function AffordProgress({
  wallet,
  price,
  reduceMotion,
}: {
  wallet: number;
  price: number;
  reduceMotion: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (wallet / price) * 100));
  return (
    <div>
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-navy-900/10">
        <motion.div
          className="h-full rounded-full bg-teal-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduceMotion ? { duration: 0 } : TRANSITION.layout}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-medium text-navy-900/55">
        {wallet.toLocaleString()} of {price.toLocaleString()} — keep spotting to unlock
      </p>
    </div>
  );
}

/** The redeemed state; draws the check in when the redemption just happened. */
function RedeemedPill({
  justBought,
  reduceMotion,
}: {
  justBought: boolean;
  reduceMotion: boolean;
}) {
  return (
    <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-teal-500/12 px-5 text-sm font-semibold text-teal-700">
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
        <motion.path
          d="M2 6.5l2.5 2.5L10 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={justBought && !reduceMotion ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: EASE.enter, delay: 0.05 }}
        />
      </svg>
      Redeemed
    </span>
  );
}

type Note = { kind: "error" | "success"; text: string };
type ItemState = {
  /** One-time items (prizes): owned/redeemed once. */
  owned: boolean;
  /** Consumables (none in the catalogue today): how many are held. */
  held: number;
  note?: Note;
  busy?: boolean;
  /** Bumped on success — replays the art scale-pop. */
  pop: number;
  /** Bumped on failure — replays the action-row shake. */
  shake: number;
  /** True only for the render right after a redemption (check draw-in). */
  justBought?: boolean;
};

export function ShopGrid({
  items,
  ownedItemIds,
  heldByItem,
  initialWallet,
  authed,
  prizeEligibility,
}: {
  items: ShopItem[];
  ownedItemIds: string[];
  heldByItem: Record<string, number>;
  initialWallet: number;
  authed: boolean;
  /** Precomputed by ShopPanel for signed-in spotters; null for guests. */
  prizeEligibility?: { eligible: boolean; reason: string | null } | null;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [wallet, setWallet] = useState(initialWallet);
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          owned: ownedItemIds.includes(i.id),
          held: heldByItem[i.id] ?? 0,
          pop: 0,
          shake: 0,
        },
      ]),
    ),
  );

  async function buy(item: ShopItem) {
    setState((s) => ({ ...s, [item.id]: { ...s[item.id], busy: true, note: undefined } }));
    try {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        wallet?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setState((s) => ({
          ...s,
          [item.id]: {
            ...s[item.id],
            busy: false,
            shake: s[item.id].shake + 1,
            note: { kind: "error", text: data.error ?? "Something went wrong. Try again." },
          },
        }));
        return;
      }
      if (typeof data.wallet === "number") {
        setWallet(data.wallet);
        emitWallet({ wallet: data.wallet });
      }
      setState((s) => {
        const prev = s[item.id];
        const isConsumable = item.type === "consumable";
        return {
          ...s,
          [item.id]: {
            owned: isConsumable ? prev.owned : true,
            held: isConsumable ? prev.held + 1 : prev.held,
            busy: false,
            pop: prev.pop + 1,
            shake: prev.shake,
            justBought: !isConsumable,
            note: {
              kind: "success",
              text:
                item.type === "prize"
                  ? "Redeemed! PEBL will email you to arrange delivery."
                  : "Added to your stash.",
            },
          },
        };
      });
    } catch {
      setState((s) => ({
        ...s,
        [item.id]: {
          ...s[item.id],
          busy: false,
          shake: s[item.id].shake + 1,
          note: { kind: "error", text: "Network error. Try again." },
        },
      }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="pebl-surface flex items-center justify-between gap-3 rounded-card px-5 py-3"
        aria-live="polite"
      >
        <span className="text-sm text-navy-900/72">Pebbles to spend</span>
        <span className="inline-flex items-center gap-1.5 text-teal-700">
          <PebbleGlyph size={15} />
          <span className="text-lg font-semibold tabular-nums">
            <AnimatedCount value={wallet} />
          </span>
        </span>
      </div>

      {!authed && (
        <div className="pebl-surface flex flex-col gap-3 rounded-card px-5 py-4">
          <p className="text-sm text-navy-900/72">
            Sign in to spend the Pebbles you earn in the feed.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Sign in
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item, idx) => {
          const st = state[item.id];
          const isPrize = item.type === "prize";
          const isConsumable = item.type === "consumable";
          const owned = !isConsumable && st?.owned;
          const held = st?.held ?? 0;
          const atCap = isConsumable && item.maxHold ? held >= item.maxHold : false;
          const affordable = wallet >= item.price;
          const gated =
            isPrize && affordable && !!prizeEligibility && !prizeEligibility.eligible;
          const disabled = !authed || owned || atCap || st?.busy || !affordable || gated;
          const label = st?.busy
            ? isPrize
              ? "Redeeming…"
              : "Buying…"
            : !authed
              ? "Sign in to redeem"
              : atCap
                ? "Stash full"
                : !affordable
                  ? `Earn ${(item.price - wallet).toLocaleString()} more`
                  : isPrize
                    ? "Redeem"
                    : "Buy";
          return (
            <motion.li
              key={item.id}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...TRANSITION.standard, delay: idx * 0.06 }}
              className="pebl-surface rounded-card p-4 shadow-chip sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center">
                <ItemArt item={item} popNonce={st?.pop ?? 0} reduceMotion={reduceMotion} />

                <div className="flex flex-col gap-3">
                  <div>
                    {isPrize && (
                      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-teal-600">
                        Real-world prize
                      </p>
                    )}
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <h3 className="font-brand text-h3 text-navy-900">{item.name}</h3>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-teal-700">
                        <PebbleGlyph />
                        {item.price.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-navy-900/72">{item.blurb}</p>
                    {isConsumable && item.maxHold && (
                      <p className="mt-1 text-xs font-medium text-teal-700">
                        Held: {held}/{item.maxHold}
                      </p>
                    )}
                  </div>

                  <motion.div
                    key={st?.shake ?? 0}
                    initial={false}
                    animate={st?.shake && !reduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col gap-2"
                  >
                    {owned ? (
                      <RedeemedPill justBought={!!st?.justBought} reduceMotion={reduceMotion} />
                    ) : (
                      <motion.button
                        type="button"
                        onClick={() => buy(item)}
                        disabled={disabled}
                        whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
                        className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-6 text-sm font-semibold text-white transition-opacity hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {label}
                      </motion.button>
                    )}

                    {authed && !owned && !affordable && (
                      <AffordProgress
                        wallet={wallet}
                        price={item.price}
                        reduceMotion={reduceMotion}
                      />
                    )}

                    {gated && !st?.note && (
                      <p className="text-xs text-navy-900/72" role="status">
                        {prizeEligibility?.reason}
                      </p>
                    )}

                    <AnimatePresence mode="wait" initial={false}>
                      {st?.note && (
                        <motion.p
                          key={st.note.text}
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={TRANSITION.micro}
                          className={`text-xs ${
                            st.note.kind === "error" ? "text-danger" : "text-teal-700"
                          }`}
                          role={st.note.kind === "error" ? "alert" : "status"}
                        >
                          {st.note.text}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      <p className="px-1 text-xs text-navy-900/55">
        More rewards arrive as the community grows. Prizes are posted within the UK; PEBL will
        contact you by email to arrange delivery.
      </p>
    </div>
  );
}
