"use client";

import { useState } from "react";
import Link from "next/link";
import { emitWallet } from "@/lib/pebble-bus";
import type { ShopItem } from "@/lib/shop/catalogue";

/** A small outline pebble for the price pill (matches the Pebble bag glyph). */
function PebbleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
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
  const [wallet, setWallet] = useState(initialWallet);
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        { owned: ownedItemIds.includes(i.id), held: heldByItem[i.id] ?? 0 },
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
            note: {
              kind: "success",
              text: isConsumable ? "Added to your stash." : "Unlocked!",
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
          <span className="text-lg font-semibold tabular-nums">{wallet.toLocaleString()}</span>
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
        {items.map((item) => {
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
            <li key={item.id} className="pebl-surface flex flex-col gap-3 rounded-card p-4">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-brand-heading text-base text-navy-900">{item.name}</h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-teal-700">
                    <PebbleGlyph />
                    {item.price.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-navy-900/72">{item.blurb}</p>
                {isConsumable && (
                  <p className="mt-1 text-xs font-medium text-teal-700">
                    Held: {held}
                    {item.maxHold ? ` / ${item.maxHold}` : ""}
                  </p>
                )}
              </div>

              {owned ? (
                <span className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-500/12 px-4 text-sm font-semibold text-teal-700">
                  Owned
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => buy(item)}
                  disabled={disabled}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition-opacity hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {label}
                </button>
              )}

              {st?.note && (
                <p
                  className={`text-xs ${st.note.kind === "error" ? "text-danger" : "text-teal-700"}`}
                  role={st.note.kind === "error" ? "alert" : "status"}
                >
                  {st.note.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="px-1 text-xs text-navy-900/55">
        Cosmetics and streak protection for now; real-world rewards arrive once the Pebbles economy is
        locked down.
      </p>
    </div>
  );
}
