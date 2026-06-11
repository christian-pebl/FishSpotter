import { SHAPE_CLASS, type ShapeClass } from "@/lib/idguide/traits";

/**
 * Map a coarse reference string (a Snippet.staffAnswer like "Flatfish", "Fish",
 * "Snail / slug", "It's just a Fish") to its shape class, or null when it is not
 * a group label. The "How to spot a [X] next time" flow uses this to show the
 * group guide instead of degrading to a full-catalogue search when the reference
 * is a group rather than a single species.
 *
 * Callers MUST try species resolution first and only fall back to this — a
 * genuine species name ("Curled octopus") should open its own card, while a bare
 * group word ("Octopus", "Crab") opens the group guide.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "");

// Synonyms + gate labels beyond the bare class keys. Keys are normalised
// (letters only), so "Snail / slug" -> "snailslug", "It's just a Fish" ->
// "itsjustafish".
const ALIASES: Record<string, ShapeClass> = {
  itsjustafish: "fish",
  justafish: "fish",
  crabs: "crab",
  jelly: "jellyfish",
  seajelly: "jellyfish",
  seastar: "starfish",
  snail: "gastropod",
  seasnail: "gastropod",
  slug: "gastropod",
  seaslug: "gastropod",
  snailslug: "gastropod",
  cuttlefish: "squid",
  octopus: "squid",
  cephalopod: "squid",
};

export function resolveShapeClassRef(
  name: string | null | undefined,
): ShapeClass | null {
  if (!name) return null;
  const key = norm(name);
  if (!key) return null;
  if ((SHAPE_CLASS as readonly string[]).includes(key)) return key as ShapeClass;
  return ALIASES[key] ?? null;
}
