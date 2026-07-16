/**
 * Shared, request-coalescing loader for the signed-in user's own answers.
 *
 * The feed mounts every card at once (no windowing yet), and each card's quiz
 * hook used to fetch `/api/answers/my?snippetId=X` on mount — an N+1 that scaled
 * with the number of cards on screen (~38 requests per feed load). This module
 * collapses that into a SINGLE `/api/answers/my` call: the first card to ask
 * kicks off one fetch of the whole answer set, every other concurrent card
 * awaits the same in-flight promise, and thereafter reads from the cached map.
 *
 * The cache is keyed by user id so an in-session account switch (no full reload)
 * refetches rather than serving the previous user's answers.
 */

export type MyAnswerLite = {
  chosenOption: string;
  isCorrect: boolean | null;
  points: number;
};

let cacheUserId: string | null = null;
let cache: Map<string, MyAnswerLite> | null = null;
let pending: Promise<Map<string, MyAnswerLite>> | null = null;

async function fetchAll(): Promise<Map<string, MyAnswerLite>> {
  const res = await fetch("/api/answers/my");
  const map = new Map<string, MyAnswerLite>();
  if (!res.ok) return map;
  const data = await res.json();
  for (const a of data.answers ?? []) {
    if (!a?.snippetId) continue;
    map.set(a.snippetId, {
      chosenOption: a.chosenOption,
      isCorrect: a.isCorrect ?? null,
      points: a.points ?? 0,
    });
  }
  return map;
}

function ensureUser(userId: string) {
  if (cacheUserId !== userId) {
    cacheUserId = userId;
    cache = null;
    pending = null;
  }
}

/**
 * Resolve one snippet's answer for `userId`, sharing a single underlying fetch
 * across all concurrent callers. Returns null when the user hasn't answered it
 * (or on a transient fetch failure — the caller stays answerable).
 */
export async function getMyAnswer(
  userId: string,
  snippetId: string,
): Promise<MyAnswerLite | null> {
  ensureUser(userId);
  if (cache) return cache.get(snippetId) ?? null;

  if (!pending) {
    pending = fetchAll()
      .then((map) => {
        cache = map;
        pending = null;
        return map;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }

  try {
    const map = await pending;
    return map.get(snippetId) ?? null;
  } catch {
    return null;
  }
}

/**
 * Keep the shared cache correct after a submit, so a card that remounts reflects
 * the answer without triggering a refetch.
 */
export function setMyAnswer(
  userId: string,
  snippetId: string,
  answer: MyAnswerLite,
): void {
  ensureUser(userId);
  if (!cache) cache = new Map();
  cache.set(snippetId, answer);
}
