/**
 * Generated nicknames for under-13 spotters.
 *
 * A child who types a username may type their real name, and a full name is
 * personal information under COPPA. So under-13s do not type one: they pick
 * from generated names like "SwiftWrasse42", and the server accepts only
 * names this module could have produced (isGeneratedNickname). Older
 * spotters still type their own.
 *
 * Pure, and safe on both sides: the client offers suggestions, the server
 * re-checks whatever comes back.
 */

export const NICKNAME_ADJECTIVES = [
  "Swift",
  "Brave",
  "Bright",
  "Calm",
  "Clever",
  "Curious",
  "Deep",
  "Gentle",
  "Happy",
  "Keen",
  "Lucky",
  "Mighty",
  "Quick",
  "Quiet",
  "Salty",
  "Sandy",
  "Shiny",
  "Sunny",
  "Tidal",
  "Wavy",
] as const;

export const NICKNAME_CREATURES = [
  "Wrasse",
  "Pollack",
  "Blenny",
  "Goby",
  "Gurnard",
  "Crab",
  "Lobster",
  "Prawn",
  "Starfish",
  "Urchin",
  "Octopus",
  "Cuttlefish",
  "Squid",
  "Jellyfish",
  "Seal",
  "Puffin",
  "Mackerel",
  "Dragonet",
  "Whelk",
  "Limpet",
] as const;

const PATTERN = /^([A-Z][a-z]+)([A-Z][a-z]+)(\d{2})$/;

/** A random nickname. `random` is injectable so tests are deterministic. */
export function generateNickname(random: () => number = Math.random): string {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];
  const digits = String(Math.floor(random() * 90) + 10);
  return `${pick(NICKNAME_ADJECTIVES)}${pick(NICKNAME_CREATURES)}${digits}`;
}

/** `count` different nicknames to choose from. */
export function nicknameSuggestions(
  count: number,
  random: () => number = Math.random,
): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < count * 20) out.add(generateNickname(random));
  return Array.from(out);
}

/** True only for a name generateNickname could have produced. */
export function isGeneratedNickname(name: string): boolean {
  const m = PATTERN.exec(name.trim());
  if (!m) return false;
  const [, adjective, creature] = m;
  return (
    (NICKNAME_ADJECTIVES as readonly string[]).includes(adjective) &&
    (NICKNAME_CREATURES as readonly string[]).includes(creature)
  );
}
