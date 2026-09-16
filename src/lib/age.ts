/**
 * Who may do what, by self-declared age band. The one place these rules live.
 *
 * Why this exists (16 Sep 2026): a catch-up email went to ten US school
 * addresses, one of them a PreK-8 school, all from guests who had never been
 * asked their age. FishSpotter is used by children, including likely US
 * under-13s, so the UK Children's Code and US COPPA both apply. The rules:
 *
 *   under_13  Plays with a nickname. Their own email is never collected; a
 *             parent's emailed consent saves the account or unlocks the prize
 *             (src/lib/parental-consent.ts). Never on a public list, cannot
 *             comment, no optional email, no analytics, no AI chat.
 *   13_17     Full account. Off the public leaderboard by default (they may
 *             switch it on). Weekly digest and new-clip emails only if they
 *             opt in; never "streak about to end" nudges, which lean on the
 *             fear of losing something (Children's Code, nudge techniques).
 *             A prize needs a parent's OK before it is posted.
 *   18_plus   Everything.
 *   null      Not asked yet. Treated as possibly a child until they answer:
 *             hidden from public lists, no optional email, no prize, no
 *             comments. AgeCheck asks them on their next visit.
 *
 * The band is self-declared, which the ICO accepts for a low-risk service,
 * and it cannot be changed from inside the app once given, so a child cannot
 * answer again to get round a rule. Corrections go through hello@.
 *
 * Pure: no Prisma, no React. Imported by server routes and client components.
 */

export const AGE_BANDS = ["under_13", "13_17", "18_plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** What the JWT and the client carry when no band is on record. */
export const AGE_UNKNOWN = "unknown" as const;
export type AgeBandOrUnknown = AgeBand | typeof AGE_UNKNOWN;

/** Labels shown on the age question. Neutral: none is marked as the right answer. */
export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  under_13: "Under 13",
  "13_17": "13 to 17",
  "18_plus": "18 or over",
};

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}

/** A stored or submitted value as a band, or null for anything else. */
export function parseAgeBand(value: unknown): AgeBand | null {
  return isAgeBand(value) ? value : null;
}

/** The session-facing form: a band, or "unknown". */
export function toAgeBandOrUnknown(value: unknown): AgeBandOrUnknown {
  return parseAgeBand(value) ?? AGE_UNKNOWN;
}

type BandInput = AgeBand | AgeBandOrUnknown | string | null | undefined;

function band(value: BandInput): AgeBand | null {
  return parseAgeBand(value);
}

export function isUnder13(value: BandInput): boolean {
  return band(value) === "under_13";
}

/** Under 18, INCLUDING under 13. Unknown is not a minor here; see isAgeKnown. */
export function isMinor(value: BandInput): boolean {
  const b = band(value);
  return b === "under_13" || b === "13_17";
}

export function isAdult(value: BandInput): boolean {
  return band(value) === "18_plus";
}

export function isAgeKnown(value: BandInput): boolean {
  return band(value) !== null;
}

/**
 * The leaderboard setting a new band starts with. Adults are listed, as they
 * always were; under-18s start private (Children's Code, high privacy by
 * default).
 */
export function defaultLeaderboardOptIn(value: BandInput): boolean {
  return isAdult(value);
}

/** Whether the spotter may switch public listing on for themselves. */
export function canChooseLeaderboardVisibility(value: BandInput): boolean {
  const b = band(value);
  return b === "13_17" || b === "18_plus";
}

/**
 * Whether other people may see this spotter's chosen name: on the public
 * leaderboard, on their profile page, beside their comments. Needs BOTH a
 * band that allows it and the spotter's own setting. Under-13s and anyone not
 * yet asked are never named in public, whatever the stored setting says.
 */
export function canBePubliclyNamed(user: {
  ageBracket: string | null | undefined;
  leaderboardOptIn: boolean;
}): boolean {
  return canChooseLeaderboardVisibility(user.ageBracket) && user.leaderboardOptIn;
}

/**
 * The same rule as a Prisma `where` fragment, for queries that list people.
 * Keep in step with canBePubliclyNamed (age.test.ts checks both agree).
 */
export const PUBLICLY_NAMED_WHERE = {
  leaderboardOptIn: true,
  ageBracket: { in: ["13_17", "18_plus"] },
} as const;

/** Posting a comment: free text other spotters read. */
export function canPostComments(value: BandInput): boolean {
  const b = band(value);
  return b === "13_17" || b === "18_plus";
}

/** The weekly digest and new-clip emails, both opt-in. */
export function canReceiveOptionalEmail(value: BandInput): boolean {
  const b = band(value);
  return b === "13_17" || b === "18_plus";
}

/** Bands the optional-email crons may select, as a Prisma `in` list. */
export const OPTIONAL_EMAIL_BANDS = ["13_17", "18_plus"] as const;

/** "Your streak is on the line" emails: adults only. */
export function canReceiveStreakNudge(value: BandInput): boolean {
  return isAdult(value);
}

/** First-party usage analytics tied to a signed-in account. */
export function canRecordAccountAnalytics(value: BandInput): boolean {
  const b = band(value);
  return b === "13_17" || b === "18_plus";
}

/** The ID-guide chat sends free text to an AI provider: adults only. */
export function canUseAiChat(value: BandInput): boolean {
  return isAdult(value);
}

/** Posting a prize to anyone under 18 needs a parent's OK first. */
export function prizeNeedsParentConsent(value: BandInput): boolean {
  return isMinor(value);
}

/**
 * Whether the spotter can attach their OWN email address. Under-13s cannot:
 * a parent's consent saves their account instead.
 */
export function canAttachOwnEmail(value: BandInput): boolean {
  const b = band(value);
  return b === "13_17" || b === "18_plus";
}

/**
 * Placeholder addresses carried by accounts with no real email (guests and
 * under-13s). The domain cannot receive mail.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "guest.fishspotter.local";

export function placeholderEmail(uuid: string): string {
  return `guest_${uuid}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
