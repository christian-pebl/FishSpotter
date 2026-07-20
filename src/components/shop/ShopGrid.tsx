"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { emitWallet } from "@/lib/pebble-bus";
import { TIDE_FREEZE_ID, type ShopItem } from "@/lib/shop/catalogue";
import { EASE, TRANSITION, spring } from "@/lib/motion";

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
 * Miniature of the gold nameplate as it renders on /u/[id] (amber name + star),
 * with a slow shimmer sweep so "gold" reads as gold, not just orange text.
 */
function NameplatePreview({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="rounded-modal bg-white px-4 py-2 shadow-chip">
      <p className="text-[9px] uppercase tracking-eyebrow text-navy-900/45">Spotter profile</p>
      <p className="relative mt-0.5 flex items-center gap-1.5 overflow-hidden text-sm font-bold text-amber-500">
        Your name
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M7 1l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 9.4 3.4 11.8l.8-3.7L1.4 5.5l3.8-.4z" />
        </svg>
        {!reduceMotion && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-8 -skew-x-12 bg-white/70"
            initial={{ x: "-150%" }}
            animate={{ x: "450%" }}
            transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2 }}
          />
        )}
      </p>
    </div>
  );
}

/** Miniature of the coral profile-accent band exactly as /u/[id] renders it. */
function AccentPreview() {
  return (
    <div className="w-[170px] overflow-hidden rounded-modal bg-white shadow-chip">
      <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-300 to-teal-400" />
      <div className="px-4 py-2">
        <p className="text-[9px] uppercase tracking-eyebrow text-navy-900/45">Spotter profile</p>
        <p className="mt-0.5 text-sm font-bold text-navy-900">Your name</p>
      </div>
    </div>
  );
}

/** Shield-over-wave: the streak survives the missed tide. Gentle bob when motion is allowed. */
function TideFreezeArt({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="h-12 w-12 text-teal-600"
      fill="none"
      aria-hidden="true"
      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
      transition={reduceMotion ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d="M24 5.5l14.5 5.2v10.8c0 9.3-6.5 16.2-14.5 20.5C16 37.7 9.5 30.8 9.5 21.5V10.7z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 25.5c2.8-3.4 5.7-3.4 8.5 0s5.7 3.4 8.5 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

/**
 * The visual banner at the top of each card: shows what you're buying rather
 * than describing it. `popNonce` bumps replay a small celebratory scale-pop
 * (fired on successful purchase).
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
  return (
    <motion.div
      key={popNonce}
      initial={false}
      animate={popNonce > 0 && !reduceMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: EASE.enter }}
      className="flex h-24 items-center justify-center overflow-hidden rounded-modal bg-[color:var(--surface-muted)]"
    >
      {item.kind === "nameplate" ? (
        <NameplatePreview reduceMotion={reduceMotion} />
      ) : item.kind === "profile-accent" ? (
        <AccentPreview />
      ) : item.id === TIDE_FREEZE_ID ? (
        <TideFreezeArt reduceMotion={reduceMotion} />
      ) : (
        <span className="text-teal-600">
          <PebbleGlyph size={22} />
        </span>
      )}
    </motion.div>
  );
}

/** Visual hold slots for a consumable: filled wave pips pop in as you stock up. */
function HeldPips({
  held,
  max,
  reduceMotion,
}: {
  held: number;
  max: number;
  reduceMotion: boolean;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < held;
        return (
          <motion.span
            key={`${i}-${filled}`}
            initial={filled && !reduceMotion ? { scale: 0.4, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring.cheer}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
              filled
                ? "border-teal-500 bg-teal-500/15 text-teal-700"
                : "border-navy-900/15 text-navy-900/20"
            }`}
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
              <path
                d="M2 6c1.3-1.6 2.7-1.6 4 0s2.7 1.6 4 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </motion.span>
        );
      })}
      <span className="ml-1 text-xs font-medium text-navy-900/55">
        {held}/{max} held
      </span>
    </div>
  );
}

/** Progress toward affording an item — turns a disabled buy button into a goal. */
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

/** The Owned state; draws the check in when the purchase just happened. */
function OwnedPill({ justBought, reduceMotion }: { justBought: boolean; reduceMotion: boolean }) {
  return (
    <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-teal-500/12 px-4 text-sm font-semibold text-teal-700">
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
      Owned
    </span>
  );
}

type Note = { kind: "error" | "success"; text: string };
type ItemState = {
  /** Cosmetics: owned once. */
  owned: boolean;
  /** Consumables: how many are held (unspent). */
  held: number;
  note?: Note;
  busy?: boolean;
  /** Bumped on successful purchase — replays the art scale-pop. */
  pop: number;
  /** Bumped on a failed purchase — replays the action-row shake. */
  shake: number;
  /** True only for the render right after a cosmetic purchase (check draw-in). */
  justBought?: boolean;
};

export function ShopGrid({
  items,
  ownedItemIds,
  heldByItem,
  initialWallet,
  authed,
}: {
  items: ShopItem[];
  ownedItemIds: string[];
  heldByItem: Record<string, number>;
  initialWallet: number;
  authed: boolean;
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
            note: { kind: "error", text: data.error ?? "Purchase failed. Try again." },
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
              text: isConsumable ? "Added to your stash." : "Unlocked — it's live on your profile.",
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

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item, idx) => {
          const st = state[item.id];
          const isConsumable = item.type === "consumable";
          const owned = !isConsumable && st?.owned;
          const held = st?.held ?? 0;
          const atCap = isConsumable && item.maxHold ? held >= item.maxHold : false;
          const affordable = wallet >= item.price;
          const disabled = !authed || owned || atCap || st?.busy || !affordable;
          const label = st?.busy
            ? isConsumable
              ? "Buying…"
              : "Unlocking…"
            : !authed
              ? "Sign in to buy"
              : atCap
                ? "Stash full"
                : !affordable
                  ? `Earn ${(item.price - wallet).toLocaleString()} more`
                  : isConsumable
                    ? held > 0
                      ? "Buy another"
                      : "Buy"
                    : "Unlock";
          return (
            <motion.li
              key={item.id}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...TRANSITION.standard, delay: idx * 0.06 }}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              className="pebl-surface flex flex-col gap-3 rounded-card p-4 shadow-chip transition-shadow hover:shadow-card"
            >
              <ItemArt item={item} popNonce={st?.pop ?? 0} reduceMotion={reduceMotion} />

              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-brand text-base text-navy-900">{item.name}</h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-teal-700">
                    <PebbleGlyph />
                    {item.price.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-navy-900/72">{item.blurb}</p>
                {isConsumable && item.maxHold && (
                  <HeldPips held={held} max={item.maxHold} reduceMotion={reduceMotion} />
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
                  <OwnedPill justBought={!!st?.justBought} reduceMotion={reduceMotion} />
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => buy(item)}
                    disabled={disabled}
                    whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition-opacity hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {label}
                  </motion.button>
                )}

                {authed && !owned && !affordable && (
                  <AffordProgress wallet={wallet} price={item.price} reduceMotion={reduceMotion} />
                )}

                <AnimatePresence mode="wait" initial={false}>
                  {st?.note && (
                    <motion.p
                      key={st.note.text}
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={TRANSITION.micro}
                      className={`text-xs ${st.note.kind === "error" ? "text-danger" : "text-teal-700"}`}
                      role={st.note.kind === "error" ? "alert" : "status"}
                    >
                      {st.note.text}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.li>
          );
        })}

        <motion.li
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TRANSITION.standard, delay: items.length * 0.06 }}
          className="flex flex-col justify-center gap-2 rounded-card border border-dashed border-navy-900/20 bg-white/50 p-5"
        >
          <div className="flex items-center gap-2 text-navy-900/55">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow">Coming soon</span>
          </div>
          <h3 className="font-brand text-base text-navy-900/80">Real-world rewards</h3>
          <p className="text-sm leading-5 text-navy-900/60">
            Field guidebooks and PEBL SubCam experiences arrive once the Pebbles economy has proven
            itself. Keep spotting — the Pebbles you bank now carry over.
          </p>
        </motion.li>
      </ul>
    </div>
  );
}
