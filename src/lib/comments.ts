/**
 * Clip comments — the public per-clip discussion thread + the PEBL feedback inbox.
 *
 * A spotter can leave a comment on a clip after committing their own ID: the
 * species isn't in the list, the clip is too murky to call, that one looks like a
 * juvenile, or anything else they want to say about it. Comments form a PUBLIC
 * thread on the clip, and simultaneously land in a staff triage inbox at
 * /admin/comments.
 *
 * Two properties of this module are load-bearing, and both are why it exists as a
 * pure leaf (no Prisma, no React, no next-auth) rather than as logic inlined into
 * the route handlers:
 *
 *   1. VISIBILITY IS A PURE DECISION. The thread must stay invisible until the
 *      viewer has answered the clip themselves. That isn't politeness: the Pebbles
 *      economy pays for INDEPENDENT convergence (src/lib/consensus.ts credits a
 *      camp when spotters agree, src/lib/trust.ts propagates reputation through
 *      those camps), so a thread readable before you commit would quietly turn
 *      consensus into a measurement of copying. The route enforces the gate; this
 *      module owns every downstream visibility rule (hidden comments, authorship,
 *      admin override) so they are unit-tested rather than reviewed.
 *
 *   2. SERIALISATION HAS EXACTLY ONE DOOR. `toPublicComment` is the only way a
 *      comment becomes a client payload, and it builds its result by explicit
 *      field construction — never by spreading a Prisma row. `adminNote` (internal
 *      staff commentary) and the author's email address therefore cannot leak by
 *      someone adding a column later and forgetting to strip it. The author's
 *      email is not even a parameter here: routes resolve `isPebl` via
 *      isAdminUser() in src/lib/admin.ts and pass down a boolean, so the address
 *      never enters this module's scope at all.
 *
 * See implementation/2026-08-01/user-comments-plan.md (INV-1, INV-2).
 */

// ---------------------------------------------------------------------------
// Code lists — fixed vocabularies, never free text, so the inbox stays
// filterable and a hostile client can't invent a status.
// ---------------------------------------------------------------------------

/**
 * Why the spotter spoke up. Public-facing tags that double as triage routing:
 * each one maps onto a PEBL tool that already exists, which is what makes the
 * inbox actionable rather than a suggestion box nobody drains.
 *
 *   not-listed  -> species catalogue onboarding (npm run db:onboard-species)
 *   unclear     -> Snippet.excluded in TRDesk4, or a difficulty re-score
 *   wrong-track -> SnippetTrackEditor at /admin/snippets/[id]
 *   life-stage  -> life-stage buckets in src/data/species-images.json
 *   disagree    -> reference / consensus review
 *   note        -> general triage (the default; a plain remark)
 */
export const REASON_CODES = [
  "not-listed",
  "unclear",
  "wrong-track",
  "life-stage",
  "disagree",
  "note",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const DEFAULT_REASON: ReasonCode = "note";

/** Short spotter-facing labels for the composer's reason chips. */
export const REASON_LABELS: Record<ReasonCode, string> = {
  "not-listed": "The species isn't in the list",
  unclear: "Too unclear to call",
  "wrong-track": "The trail follows the wrong animal",
  "life-stage": "Juvenile or different life stage",
  disagree: "I'd call this something else",
  note: "Something else",
};

/**
 * What actually happened, recorded when staff resolve a comment. This is what
 * lets /admin/metrics carry a real funder line ("N spotter reports, M catalogue
 * additions") instead of a raw comment count.
 */
export const OUTCOME_CODES = [
  "catalogue-added",
  "clip-excluded",
  "track-fixed",
  "reference-updated",
  "no-action",
] as const;
export type OutcomeCode = (typeof OUTCOME_CODES)[number];

/** Why a reader flagged a comment. */
export const REPORT_REASONS = [
  "abusive",
  "spam",
  "off-topic",
  "personal-info",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Staff triage state. `dismissed` is terminal. */
export const STATUSES = ["new", "acknowledged", "resolved", "dismissed"] as const;
export type CommentStatus = (typeof STATUSES)[number];

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Hard cap on a comment body, post-sanitisation. */
export const MAX_BODY = 500;

/**
 * Top-level comments one spotter may leave on one clip. Three is enough for a
 * genuine second thought and few enough that a thread can't become one person's
 * scratchpad. Replies are not counted against it.
 */
export const MAX_PER_CLIP = 3;

/**
 * Distinct reporters that auto-hide a comment pending staff review. Deliberately
 * low: hiding is reversible and reviewed, so a false positive costs a spotter a
 * few hours of visibility, while a slow takedown costs a lot more.
 */
export const AUTO_HIDE_REPORTS = 3;

/** Matches Answer.chosenOption's cap, since a suggested name feeds that path. */
export const MAX_SUGGESTED_NAME = 80;

// ---------------------------------------------------------------------------
// Body sanitisation
// ---------------------------------------------------------------------------

// Control characters, minus the three whitespace ones worth keeping (\t \n \r).
// Strips zero-width and bidi-override characters too, which are the standard way
// to smuggle invisible content past a text filter.
const CONTROL_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Normalise a submitted body: strip control/invisible characters, collapse runs
 * of horizontal whitespace, cap consecutive blank lines, trim, and clamp to
 * MAX_BODY. Returns "" for anything that isn't a string, so the caller's empty
 * check covers both the missing and the whitespace-only case.
 */
export function sanitiseBody(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace, keep newlines
    .replace(/\n{3,}/g, "\n\n") // at most one blank line in a row
    .trim()
    .slice(0, MAX_BODY)
    .trimEnd();
}

/** Same treatment, tighter cap, single line. */
export function sanitiseSuggestedName(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SUGGESTED_NAME)
    .trimEnd();
}

// ---------------------------------------------------------------------------
// Link rejection
// ---------------------------------------------------------------------------

// Bare `.co` is deliberately absent: it is by far the highest false-positive risk
// in running prose ("a goby.Could be..."), so co.uk gets its own explicit pattern
// instead.
const SPAM_TLDS =
  "com|net|org|io|xyz|info|biz|ru|cn|shop|link|site|online|dev|app|tv|me";

const URL_PATTERNS: RegExp[] = [
  /\bhttps?:\/\//i,
  /\bwww\./i,
  new RegExp(`\\b[a-z0-9][a-z0-9-]+\\.(?:${SPAM_TLDS})(?![a-z])`, "i"),
  /\b[a-z0-9][a-z0-9-]+\.co\.uk(?![a-z])/i,
];

/**
 * True if the body contains anything link-shaped. Comments carry no links at all:
 * there is no legitimate need for one in a species discussion, and allowing them
 * would make the thread the cheapest SEO spam target in the app.
 */
export function containsUrl(body: string): boolean {
  return URL_PATTERNS.some((re) => re.test(body));
}

// ---------------------------------------------------------------------------
// Blocklist
// ---------------------------------------------------------------------------

/**
 * Word-level blocklist. A hit HOLDS the comment for review (hiddenAt set at
 * creation) rather than rejecting it, so a false positive is recoverable by a
 * human instead of silently losing a spotter's contribution.
 *
 * Matching tokenises the body into words and does exact set lookups, so it is
 * structurally immune to the Scunthorpe problem — a substring matcher on a
 * marine app would reject "bass", "cockle", "assess" and "Scunthorpe" itself,
 * all of which are things a UK spotter will genuinely type. comments.test.ts
 * pins that behaviour.
 *
 * This list is a defensible starting point covering unambiguous profanity only.
 * It does NOT yet include slurs, which need to come from a maintained source
 * under Christian's review (open decision 3 in the plan). It also makes no
 * attempt at evasion handling (spaced-out or leetspeak variants): the reader
 * report path in Phase 2 is the real backstop, and an arms race in a regex is
 * not worth having.
 */
const BLOCKLIST: readonly string[] = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "shit",
  "shite",
  "shitty",
  "bullshit",
  "cunt",
  "wanker",
  "bastard",
  "bollocks",
  "prick",
  "twat",
  "arsehole",
  "asshole",
  "dickhead",
  "motherfucker",
  "slut",
  "whore",
];

const BLOCKLIST_SET: ReadonlySet<string> = new Set(BLOCKLIST);

/**
 * The first blocked term in the body, or null. Tokenises on letters plus the
 * apostrophe so "don't" stays one word, then does exact lookups.
 */
export function hitsBlocklist(body: string): string | null {
  const words = body.toLowerCase().match(/[a-z']+/g);
  if (!words) return null;
  for (const word of words) {
    const bare = word.replace(/^'+|'+$/g, "");
    if (BLOCKLIST_SET.has(bare)) return bare;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Posting eligibility
// ---------------------------------------------------------------------------

export const POST_BLOCK_REASONS = [
  "guest-must-upgrade",
  "must-answer-first",
  "clip-limit-reached",
] as const;
export type PostBlockReason = (typeof POST_BLOCK_REASONS)[number];

export interface PosterState {
  /** User.isGuest — a username-only account with a synthetic, unverified email. */
  isGuest: boolean;
  /** Has this user submitted an Answer on this clip? */
  hasAnsweredClip: boolean;
  /** How many TOP-LEVEL comments they already have on this clip. */
  existingOnClip: number;
  /**
   * Is this post a reply to someone? Replies are exempt from the per-clip cap:
   * the cap exists to stop one person monologuing a thread with fresh points,
   * not to stop them answering a question put to them. Without this exemption a
   * spotter who left three comments could never reply to anyone on that clip
   * again, which reads as a broken thread rather than a limit.
   */
  isReply?: boolean;
}

export type PostGate =
  | { ok: true }
  | { ok: false; reason: PostBlockReason; message: string };

const POST_BLOCK_MESSAGES: Record<PostBlockReason, string> = {
  "guest-must-upgrade":
    "Create a free profile to join the discussion. Your spots are saved either way.",
  "must-answer-first": "Make your own call on this clip first, then join the discussion.",
  "clip-limit-reached": `You've already left ${MAX_PER_CLIP} comments on this clip.`,
};

/**
 * Whether this spotter may post on this clip, and why not if they may not.
 *
 * Guests are blocked deliberately (plan INV-4). A guest account is username-only
 * with a synthetic placeholder email and no verification step, which makes it a
 * free, unlimited posting identity and the single most obvious abuse path in a
 * public thread. They can still READ the thread once they've answered, and the
 * block doubles as the existing "save my finds" conversion moment. Easy to relax
 * later; painful to tighten once people are used to it.
 */
export function canPost(state: PosterState): PostGate {
  const block = (reason: PostBlockReason): PostGate => ({
    ok: false,
    reason,
    message: POST_BLOCK_MESSAGES[reason],
  });
  if (state.isGuest) return block("guest-must-upgrade");
  if (!state.hasAnsweredClip) return block("must-answer-first");
  if (!state.isReply && state.existingOnClip >= MAX_PER_CLIP) {
    return block("clip-limit-reached");
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Triage state machine
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<CommentStatus, readonly CommentStatus[]> = {
  new: ["acknowledged", "resolved", "dismissed"],
  acknowledged: ["resolved", "dismissed"],
  // Reopening a resolved item is legitimate (the fix didn't hold). Going back to
  // `new` is not: `new` means "no human has looked at this yet", which stops
  // being true permanently once someone has.
  resolved: ["acknowledged"],
  // Terminal. Dismissed is for spam and noise; if it turns out to matter, the
  // spotter can comment again.
  dismissed: [],
};

export function canTransition(from: CommentStatus, to: CommentStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Reports needed before a comment auto-hides pending review. */
export function shouldAutoHide(reportCount: number): boolean {
  return reportCount >= AUTO_HIDE_REPORTS;
}

// ---------------------------------------------------------------------------
// Visibility + serialisation
// ---------------------------------------------------------------------------

/**
 * The subset of a Prisma Comment row this module needs. Declared structurally so
 * a real row satisfies it without a cast, and a test fixture can be minimal.
 */
export interface CommentRowLike {
  id: string;
  userId: string;
  parentId: string | null;
  reason: string;
  body: string;
  suggestedName: string | null;
  hiddenAt: Date | null;
  reportCount: number;
  createdAt: Date;
}

/**
 * Author fields safe to hand to this module. Note what is absent: the author's
 * email and emailVerified. Routes resolve staff status with isAdminUser() from
 * src/lib/admin.ts and pass the resulting boolean, so an address cannot leak
 * through here even by accident.
 */
export interface CommentAuthorLike {
  id: string;
  displayName: string | null;
  name: string | null;
  isPebl: boolean;
}

export interface Viewer {
  /** null when signed out. */
  userId: string | null;
  isAdmin: boolean;
}

export interface PublicComment {
  id: string;
  parentId: string | null;
  reason: ReasonCode;
  body: string;
  suggestedName: string | null;
  authorId: string;
  authorName: string;
  /** Renders the teal PEBL chip, so an official answer is distinguishable. */
  isPebl: boolean;
  isMine: boolean;
  /** Held or hidden. Only ever true in a payload the author or an admin receives. */
  isHidden: boolean;
  /** Admins only; null for everyone else. */
  reportCount: number | null;
  createdAt: string;
  replies: PublicComment[];
}

/** Matches SnippetAnswers' fallback so one spotter reads the same everywhere. */
export function authorDisplayName(author: CommentAuthorLike): string {
  return author.displayName ?? author.name ?? `Spotter ${author.id.slice(0, 6)}`;
}

/**
 * Hidden comments stay visible to their own author (so being moderated isn't a
 * silent void they keep replying into) and to staff. Everyone else never learns
 * the comment existed.
 */
export function isVisibleTo(row: CommentRowLike, viewer: Viewer): boolean {
  if (row.hiddenAt === null) return true;
  if (viewer.isAdmin) return true;
  return viewer.userId !== null && viewer.userId === row.userId;
}

function toReasonCode(raw: string): ReasonCode {
  return (REASON_CODES as readonly string[]).includes(raw)
    ? (raw as ReasonCode)
    : DEFAULT_REASON;
}

/**
 * THE serialisation door (plan INV-2). Every field is named explicitly and the
 * input row is never spread, so a column added to the schema later cannot ride
 * out to a client unnoticed. `adminNote`, `hiddenReason`, `handledBy` and
 * `outcome` are all internal and have no route out through here.
 */
export function toPublicComment(
  row: CommentRowLike,
  author: CommentAuthorLike,
  viewer: Viewer,
  replies: PublicComment[] = [],
): PublicComment {
  return {
    id: row.id,
    parentId: row.parentId,
    reason: toReasonCode(row.reason),
    body: row.body,
    suggestedName: row.suggestedName,
    authorId: author.id,
    authorName: authorDisplayName(author),
    isPebl: author.isPebl,
    isMine: viewer.userId !== null && viewer.userId === row.userId,
    isHidden: row.hiddenAt !== null,
    reportCount: viewer.isAdmin ? row.reportCount : null,
    createdAt: row.createdAt.toISOString(),
    replies,
  };
}

export interface ThreadInput {
  row: CommentRowLike;
  author: CommentAuthorLike;
}

/**
 * Build the renderable thread: drop anything this viewer may not see, serialise
 * the rest, and nest replies one level under their parent.
 *
 * Depth is capped at one on purpose. Deeper nesting is unreadable on a 390px feed
 * card and multiplies the moderation surface, so a reply whose parent is itself a
 * reply is flattened up to the same level rather than indented further. A reply
 * orphaned by its parent being hidden is promoted to top level rather than
 * vanishing, since the reply itself was not moderated.
 *
 * Ordering is oldest-first at both levels, so a thread reads as a conversation.
 */
export function threadShape(inputs: ThreadInput[], viewer: Viewer): PublicComment[] {
  const visible = inputs.filter((i) => isVisibleTo(i.row, viewer));
  const byId = new Map(visible.map((i) => [i.row.id, i]));

  const chronological = [...visible].sort(
    (a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime(),
  );

  // Resolve each comment to the top-level ancestor still visible to this viewer.
  const rootIdOf = (input: ThreadInput): string | null => {
    let current: ThreadInput | undefined = input;
    // Bounded walk: the schema allows one level, but a malformed chain must not
    // spin here, so cap the hops rather than trusting the data.
    for (let hop = 0; hop < 4 && current; hop++) {
      if (current.row.parentId === null) return current.row.id;
      const parent: ThreadInput | undefined = byId.get(current.row.parentId);
      if (!parent) return null; // parent hidden or gone: promote to top level
      current = parent;
    }
    return null;
  };

  const repliesByRoot = new Map<string, PublicComment[]>();
  const roots: ThreadInput[] = [];

  for (const input of chronological) {
    const rootId = rootIdOf(input);
    if (rootId === null || rootId === input.row.id) {
      roots.push(input);
      continue;
    }
    const list = repliesByRoot.get(rootId) ?? [];
    list.push(toPublicComment(input.row, input.author, viewer));
    repliesByRoot.set(rootId, list);
  }

  return roots.map((input) =>
    toPublicComment(input.row, input.author, viewer, repliesByRoot.get(input.row.id) ?? []),
  );
}
