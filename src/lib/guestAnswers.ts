/**
 * The guest guess queue.
 *
 * P0 "play before the wall": a signed-out spotter gets the REAL reveal locally
 * (graded by the read-only /api/answers/preview), and every guess is queued
 * here so that when they DO sign up, all of them are carried in and persisted.
 * localStorage, so the queue survives a tab close and a return within the day.
 *
 * Two things drain it, and they split the work by whether a card is mounted:
 *
 *  - A MOUNTED card drains its own entry (`useCreatureQuiz`), which is what
 *    gives the viewer the reveal on the card they are looking at.
 *  - `drainGuestAnswers` posts everything ELSE. The feed mounts only a window
 *    of cards around the active one (7 Sep 2026), so a guess made six clips ago
 *    has no card to drain it; before windowing every card mounted, so per-card
 *    draining covered the whole queue by accident. The caller passes the ids
 *    it has mounted and those are left for their cards, so the two paths never
 *    post the same guess twice.
 */

import { emitPebbles } from "@/lib/pebble-bus";
import { setMyAnswer } from "@/lib/myAnswers";

const GUEST_QUEUE_KEY = "fishspotter:guestAnswers";
const GUEST_ANSWER_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const GUEST_QUEUE_MAX = 50; // cap so a long guest run can't bloat storage

export interface PendingAnswer {
  snippetId: string;
  chosenOption: string;
  timestamp: number;
}

export function readGuestQueue(): PendingAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is PendingAnswer =>
        !!e &&
        typeof e.snippetId === "string" &&
        typeof e.chosenOption === "string" &&
        typeof e.timestamp === "number" &&
        now - e.timestamp <= GUEST_ANSWER_MAX_AGE_MS,
    );
  } catch {
    // Ignore malformed values; we'll just skip the carry.
    return [];
  }
}

export function writeGuestQueue(list: PendingAnswer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_QUEUE_KEY,
      JSON.stringify(list.slice(-GUEST_QUEUE_MAX)),
    );
  } catch {
    // ignore, non-essential
  }
}

/** Add (or replace) the guess for a snippet; returns the new queue length so
 *  the caller can drive the "save your N finds" nudge. */
export function pushGuestAnswer(snippetId: string, chosenOption: string): number {
  const list = readGuestQueue().filter((e) => e.snippetId !== snippetId);
  list.push({ snippetId, chosenOption, timestamp: Date.now() });
  writeGuestQueue(list);
  return Math.min(list.length, GUEST_QUEUE_MAX);
}

export function guestAnswerFor(snippetId: string): PendingAnswer | null {
  return readGuestQueue().find((e) => e.snippetId === snippetId) ?? null;
}

export function removeGuestAnswer(snippetId: string): void {
  writeGuestQueue(readGuestQueue().filter((e) => e.snippetId !== snippetId));
}

/**
 * Persist every queued guest guess whose card is NOT mounted, now that the
 * viewer is signed in as `userId`. Mounted cards (`except`) are left to drain
 * their own entry, so the viewer sees the reveal land on the card in front of
 * them and nothing is posted twice.
 *
 * Each entry is taken out of the queue BEFORE its request goes out, so a card
 * that mounts mid-drain cannot post it again. A request that fails on the
 * network or the server is put back, so a flaky connection at signup does not
 * throw the guest's finds away; a rejected one (4xx) is dropped, since sending
 * it again would only fail again.
 *
 * Returns how many guesses were persisted.
 */
export async function drainGuestAnswers(
  userId: string,
  except: ReadonlySet<string> = new Set(),
): Promise<number> {
  const queue = readGuestQueue();
  const mine = queue.filter((e) => !except.has(e.snippetId));
  if (mine.length === 0) return 0;
  writeGuestQueue(queue.filter((e) => except.has(e.snippetId)));

  let posted = 0;
  const retry: PendingAnswer[] = [];
  for (const entry of mine) {
    try {
      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippetId: entry.snippetId, chosenOption: entry.chosenOption }),
      });
      if (res.status >= 500) {
        retry.push(entry);
        continue;
      }
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.answer) continue;
      // Keep the shared answer cache in step, so the card reads its answer
      // when the viewer scrolls back to it instead of offering the quiz again.
      setMyAnswer(userId, entry.snippetId, {
        chosenOption: data.answer.chosenOption,
        isCorrect: data.answer.isCorrect ?? null,
        points: data.answer.points ?? 0,
      });
      if (data.pebbles) {
        emitPebbles({
          earned: data.pebbles.earned ?? 0,
          total: data.pebbles.total ?? 0,
          firstSighting: !!data.pebbles.firstSighting,
        });
      }
      posted += 1;
    } catch {
      retry.push(entry);
    }
  }
  if (retry.length > 0) writeGuestQueue([...readGuestQueue(), ...retry]);
  if (posted > 0) window.dispatchEvent(new CustomEvent("fishspotter:streak"));
  return posted;
}
