"use client";

/**
 * Tiny client event bus for the Pebble bag (top-right of the header).
 *
 * The header lives in the root layout, far from the feed card that submits an
 * answer, so rather than thread state through React we fire a window
 * CustomEvent when Pebbles are earned. The PebbleBag listens and animates the
 * freshly-earned pebbles into the pouch, then ticks the running total up.
 */

export const PEBBLE_EVENT = "fishspotter:pebbles";

export interface PebbleEarnDetail {
  /** Pebbles earned by this single action (drives the fly-in burst). */
  earned: number;
  /** The user's new running total (the bag's absolute count). */
  total: number;
  /** True when this action was a First Sighting — a bigger, brighter burst. */
  firstSighting?: boolean;
}

export function emitPebbles(detail: PebbleEarnDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PebbleEarnDetail>(PEBBLE_EVENT, { detail }));
}

export function onPebbles(handler: (detail: PebbleEarnDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<PebbleEarnDetail>).detail);
  window.addEventListener(PEBBLE_EVENT, listener);
  return () => window.removeEventListener(PEBBLE_EVENT, listener);
}

// A separate signal for the spendable WALLET (earned - spent). Fired after a
// shop purchase so the Pebble bag can draw its count down without a reload.
// Kept distinct from PEBBLE_EVENT (which carries an earn delta + fly-in burst):
// a spend has no burst, it just sets the new authoritative wallet balance.
export const PEBBLE_WALLET_EVENT = "fishspotter:wallet";

export interface WalletChangeDetail {
  /** The spotter's new spendable wallet balance. */
  wallet: number;
}

export function emitWallet(detail: WalletChangeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WalletChangeDetail>(PEBBLE_WALLET_EVENT, { detail }));
}

export function onWallet(handler: (detail: WalletChangeDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<WalletChangeDetail>).detail);
  window.addEventListener(PEBBLE_WALLET_EVENT, listener);
  return () => window.removeEventListener(PEBBLE_WALLET_EVENT, listener);
}
