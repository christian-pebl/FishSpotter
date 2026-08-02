import { describe, it, expect } from "vitest";
import {
  AUTO_HIDE_REPORTS,
  MAX_BODY,
  MAX_PER_CLIP,
  MAX_SUGGESTED_NAME,
  OUTCOME_CODES,
  REASON_CODES,
  REASON_LABELS,
  REPORT_REASONS,
  STATUSES,
  authorDisplayName,
  canPost,
  canTransition,
  containsUrl,
  hitsBlocklist,
  isVisibleTo,
  maskProfanity,
  sanitiseBody,
  sanitiseSuggestedName,
  shouldAutoHide,
  threadShape,
  toPublicComment,
  publicAuthorName,
  __tiers,
  type CommentAuthorLike,
  type CommentRowLike,
  type ThreadInput,
  type Viewer,
} from "./comments";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTHOR: CommentAuthorLike = {
  id: "user-abcdef123",
  displayName: "Ffion",
  name: null,
  isPebl: false,
  leaderboardOptIn: true,
};

const PEBL_AUTHOR: CommentAuthorLike = {
  id: "user-staff0001",
  displayName: "Christian",
  name: null,
  isPebl: true,
  leaderboardOptIn: true,
};

// A self-declared minor's default: leaderboardOptIn defaults false at signup
// (src/lib/auth.ts), which now also anonymises their PUBLIC comment name.
const OPTED_OUT_AUTHOR: CommentAuthorLike = {
  id: "user-minor0001",
  displayName: "Jamie",
  name: null,
  isPebl: false,
  leaderboardOptIn: false,
};

function row(over: Partial<CommentRowLike> = {}): CommentRowLike {
  return {
    id: "c1",
    userId: AUTHOR.id,
    parentId: null,
    reason: "note",
    body: "Looks like a juvenile to me.",
    suggestedName: null,
    hiddenAt: null,
    reportCount: 0,
    createdAt: new Date("2026-08-01T10:00:00Z"),
    ...over,
  };
}

const STRANGER: Viewer = { userId: "user-other", isAdmin: false };
const OWNER: Viewer = { userId: AUTHOR.id, isAdmin: false };
const ADMIN: Viewer = { userId: "user-staff0001", isAdmin: true };
const SIGNED_OUT: Viewer = { userId: null, isAdmin: false };

// ---------------------------------------------------------------------------

describe("code lists", () => {
  const lists = { REASON_CODES, OUTCOME_CODES, REPORT_REASONS, STATUSES };
  for (const [name, list] of Object.entries(lists)) {
    it(`${name} is non-empty and has no duplicates`, () => {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
    });
  }

  it("every reason code has a spotter-facing label", () => {
    for (const code of REASON_CODES) {
      expect(REASON_LABELS[code], `missing label for ${code}`).toBeTruthy();
    }
    expect(Object.keys(REASON_LABELS).sort()).toEqual([...REASON_CODES].sort());
  });
});

describe("sanitiseBody", () => {
  it("returns empty string for non-strings", () => {
    for (const v of [undefined, null, 42, {}, []]) {
      expect(sanitiseBody(v)).toBe("");
    }
  });

  it("trims surrounding whitespace", () => {
    expect(sanitiseBody("  a goby  ")).toBe("a goby");
  });

  it("collapses runs of horizontal whitespace but keeps line breaks", () => {
    expect(sanitiseBody("a     goby")).toBe("a goby");
    expect(sanitiseBody("a\t\t goby")).toBe("a goby");
    expect(sanitiseBody("line one\nline two")).toBe("line one\nline two");
  });

  it("caps consecutive blank lines at one", () => {
    expect(sanitiseBody("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normalises CRLF", () => {
    expect(sanitiseBody("a\r\nb")).toBe("a\nb");
  });

  it("strips control and zero-width characters", () => {
    // NUL, zero-width space, BOM, and a bidi override.
    expect(sanitiseBody("go\u0000by"), "NUL").toBe("goby");
    expect(sanitiseBody("go\u200Bby"), "zero-width space").toBe("goby");
    expect(sanitiseBody("go\uFEFFby"), "BOM").toBe("goby");
    expect(sanitiseBody("go\u202Eby"), "bidi override").toBe("goby");
  });

  it("clamps to MAX_BODY", () => {
    const long = "x".repeat(MAX_BODY + 250);
    expect(sanitiseBody(long)).toHaveLength(MAX_BODY);
  });

  it("collapses a whitespace-only body to empty, so the caller's empty check catches it", () => {
    expect(sanitiseBody("   \n\n  \t ")).toBe("");
  });
});

describe("sanitiseSuggestedName", () => {
  it("is single-line and clamped tighter than a body", () => {
    expect(MAX_SUGGESTED_NAME).toBeLessThan(MAX_BODY);
    expect(sanitiseSuggestedName("  Pollachius\n  pollachius ")).toBe(
      "Pollachius pollachius",
    );
    expect(sanitiseSuggestedName("y".repeat(200))).toHaveLength(MAX_SUGGESTED_NAME);
  });
});

describe("containsUrl", () => {
  it("catches explicit schemes", () => {
    expect(containsUrl("see http://evil.example")).toBe(true);
    expect(containsUrl("see HTTPS://Evil.Example")).toBe(true);
  });

  it("catches www and bare domains", () => {
    expect(containsUrl("go to www.spam.thing")).toBe(true);
    expect(containsUrl("buy at cheapfish.com now")).toBe(true);
    expect(containsUrl("buy at cheapfish.co.uk now")).toBe(true);
  });

  it("does not fire on ordinary marine prose", () => {
    const clean = [
      "I think it's a pollack, not a saithe.",
      "Pollachius pollachius. Pretty sure.",
      "Too murky. Could be a goby.Could be anything really.",
      "Third fish from the left, about 20cm.",
      "Is that a juvenile bib? The chin barbel looks short.",
    ];
    for (const body of clean) {
      expect(containsUrl(body), `false positive on: ${body}`).toBe(false);
    }
  });
});

describe("hitsBlocklist", () => {
  it("matches a hold-tier word on its own", () => {
    expect(hitsBlocklist("what a slut")).toBe("slut");
    expect(hitsBlocklist("WHAT A SLUT")).toBe("slut");
  });

  it("no longer holds mask-tier profanity (2026-08-02)", () => {
    // These used to hide the whole comment. They now post live and are
    // asterisked by maskProfanity() at serialisation instead — the behaviour
    // change this tier split exists for. Losing a real observation because
    // someone was rude about the visibility was the failure mode.
    expect(hitsBlocklist("this is shit")).toBeNull();
    expect(hitsBlocklist("can't see a fucking thing")).toBeNull();
    expect(hitsBlocklist("this clip is bollocks")).toBeNull();
  });

  it("returns null for clean text", () => {
    expect(hitsBlocklist("lovely little wrasse")).toBeNull();
  });

  it("is immune to the Scunthorpe problem", () => {
    // A substring matcher would reject every one of these, and four of them are
    // words a UK marine spotter will genuinely type. This is exactly why the
    // matcher tokenises into words instead of scanning substrings.
    const innocent = [
      "Caught near Scunthorpe last summer",
      "Hard to assess from this angle",
      "A classic example of a corkwing",
      "Some shiitake-looking growth on the rope",
      "Definitely a bass",
      "Two cockles on the sand",
      "The analysis was thorough",
      "Grassy weed in the background",
    ];
    for (const body of innocent) {
      expect(hitsBlocklist(body), `false positive on: ${body}`).toBeNull();
    }
  });

  it("does not hold ordinary marine-biology / anatomy vocabulary (2026-08-01 sourced list)", () => {
    // The LDNOOBW merge added ~250 words, several of which collide with real
    // ID-guide language for this specific app and were deliberately excluded.
    // This pins that exclusion so a future re-merge can't silently reintroduce
    // it (see the BLOCKLIST doc comment for the full reasoning).
    const domainVocabulary = [
      "What's the sex of this crab, male or female?",
      "Classic sexual dimorphism in wrasse, that's a male",
      "You can see the anus clearly on the sea cucumber",
      "The penis is a diagnostic feature in some cephalopods",
      "Out shrimping at low tide this morning",
      "Nice spot! xx",
      "Great find xxx",
      "The clip quality really sucks here, hard to call",
      "That's a sexy little dragonet",
    ];
    for (const body of domainVocabulary) {
      expect(hitsBlocklist(body), `false positive on: ${body}`).toBeNull();
    }
  });

  it("still catches a real slur from the sourced list", () => {
    // Confirms the LDNOOBW merge actually landed (closes plan open decision 3:
    // the original 20-word list had no slur coverage at all).
    expect(hitsBlocklist("get out of here you paki")).toBe("paki");
    expect(hitsBlocklist("total spastic move")).toBe("spastic");
  });

  it("holds a comment for review rather than silently rejecting it", () => {
    // The design contract: a hit HOLDS, it does not reject. canPost/the POST
    // route decide what happens with the result; this function only detects.
    expect(hitsBlocklist("that's just porn")).toBe("porn");
  });

  it("no longer holds marine vocabulary that collided with the sourced list", () => {
    // "butt" is a UK dialect name for a flounder (and a water butt); "scat" is
    // standard wildlife field vocabulary for droppings, and a real fish genus.
    // Both were being held on a marine app. Same rationale as the EXCLUDE set.
    expect(hitsBlocklist("Caught a butt off the rocks")).toBeNull();
    expect(hitsBlocklist("Otter scat on the slipway")).toBeNull();
  });
});

describe("maskProfanity", () => {
  it("replaces a mask-tier word with the same number of asterisks", () => {
    expect(maskProfanity("this is shit")).toBe("this is ****");
    expect(maskProfanity("this clip is bollocks")).toBe("this clip is ********");
  });

  it("is case-insensitive and leaves the rest of the sentence alone", () => {
    expect(maskProfanity("THIS IS SHIT, mate.")).toBe("THIS IS ****, mate.");
    expect(maskProfanity("Can't see a Fucking thing here")).toBe(
      "Can't see a ******* thing here",
    );
  });

  it("preserves punctuation, newlines and spacing exactly", () => {
    expect(maskProfanity("shit! really?")).toBe("****! really?");
    expect(maskProfanity("murky\n\nshit visibility")).toBe("murky\n\n**** visibility");
    expect(maskProfanity("(shit)")).toBe("(****)");
  });

  it("masks every hit in a body, not just the first", () => {
    expect(maskProfanity("shit clip, fucking useless")).toBe("**** clip, ******* useless");
  });

  it("masks inflections that are listed, without stemming", () => {
    // Listed explicitly (see MASK_WORDS): stemming is where Scunthorpe-class
    // bugs come from, so each form earns its own entry.
    expect(maskProfanity("fucked")).toBe("******");
    expect(maskProfanity("shitty")).toBe("******");
    expect(maskProfanity("wankers")).toBe("*******");
  });

  it("returns a clean body untouched", () => {
    const clean = "Two-spotted goby, I think — the twin flank spots are clear.";
    expect(maskProfanity(clean)).toBe(clean);
  });

  it("is immune to the Scunthorpe problem", () => {
    // The guard that matters most for masking: a false positive here is visible
    // garbage on a live page, not a reviewable hold. Same fixtures as
    // hitsBlocklist, plus the words the mask tier newly brought into scope.
    const innocent = [
      "Caught near Scunthorpe last summer",
      "Hard to assess from this angle",
      "A classic example of a corkwing",
      "Some shiitake-looking growth on the rope",
      "Definitely a bass",
      "Two cockles on the sand",
      "The analysis was thorough",
      "Grassy weed in the background",
      "Caught a butt off the rocks",
      "Otter scat on the slipway",
      "Bloody good spot, that",
      "A cheeky little bugger hiding in the kelp",
      "Classic sexual dimorphism in wrasse, that's a male",
      "Out shrimping at low tide this morning",
    ];
    for (const body of innocent) {
      expect(maskProfanity(body), `false positive on: ${body}`).toBe(body);
    }
  });
});

describe("blocklist tiers", () => {
  it("keeps the two tiers disjoint", () => {
    const overlap = __tiers.MASK_WORDS.filter((w) => __tiers.HOLD_WORDS.includes(w));
    expect(overlap, `word in both tiers: ${overlap.join(", ")}`).toEqual([]);
  });

  it("never masks a slur", () => {
    // THE guardrail for the tier split. Masking a slur is worse than hiding it:
    // "get out of here you ****" is still a hostile comment, now live and
    // permanent with a fig leaf on it. If a list refresh ever promotes one of
    // these into MASK_WORDS, this fails.
    const slurs = [
      "paki", "nigger", "nigga", "wetback", "spic", "kike", "coon", "darkie",
      "raghead", "towelhead", "beaner", "honkey", "negro", "pikey", "jigaboo",
      "slanteye", "fag", "faggot", "bulldyke", "tranny", "shemale", "spastic",
      "mong", "neonazi", "swastika",
    ];
    for (const slur of slurs) {
      expect(__tiers.MASK_WORDS, `slur in the mask tier: ${slur}`).not.toContain(slur);
      // And each is still actually caught by the hold tier.
      expect(hitsBlocklist(`you ${slur}`), `slur no longer held: ${slur}`).toBe(slur);
    }
  });

  it("masks the words Christian named, and holds nothing milder than them", () => {
    expect(__tiers.MASK_WORDS).toContain("shit");
    expect(__tiers.MASK_WORDS).toContain("fuck");
    expect(hitsBlocklist("shit")).toBeNull();
    expect(hitsBlocklist("fuck")).toBeNull();
  });
});

describe("canPost", () => {
  const base = { isGuest: false, hasAnsweredClip: true, existingOnClip: 0 };

  it("allows a signed-in spotter who has answered", () => {
    expect(canPost(base)).toEqual({ ok: true });
  });

  it("blocks guests (INV-4)", () => {
    const gate = canPost({ ...base, isGuest: true });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.reason).toBe("guest-must-upgrade");
      expect(gate.message).toBeTruthy();
    }
  });

  it("blocks a spotter who has not answered this clip", () => {
    const gate = canPost({ ...base, hasAnsweredClip: false });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("must-answer-first");
  });

  it("blocks at the per-clip cap", () => {
    expect(canPost({ ...base, existingOnClip: MAX_PER_CLIP - 1 }).ok).toBe(true);
    const gate = canPost({ ...base, existingOnClip: MAX_PER_CLIP });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("clip-limit-reached");
  });

  it("exempts replies from the per-clip cap", () => {
    // Regression (found in live validation, 2026-08-01): the cap was applied to
    // replies too, so a spotter who had left 3 comments on a clip could never
    // answer anyone there again. The cap is there to stop one person monologuing
    // with fresh points, not to mute them in a conversation.
    const atCap = { ...base, existingOnClip: MAX_PER_CLIP };
    expect(canPost(atCap).ok).toBe(false);
    expect(canPost({ ...atCap, isReply: true }).ok).toBe(true);
  });

  it("still applies the guest and answered rules to replies", () => {
    const atCap = { ...base, existingOnClip: MAX_PER_CLIP, isReply: true };
    expect(canPost({ ...atCap, isGuest: true }).ok).toBe(false);
    expect(canPost({ ...atCap, hasAnsweredClip: false }).ok).toBe(false);
  });

  it("checks the guest rule before the others, so a guest never sees a confusing message", () => {
    const gate = canPost({ isGuest: true, hasAnsweredClip: false, existingOnClip: 99 });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("guest-must-upgrade");
  });
});

describe("canTransition", () => {
  it("allows forward triage moves", () => {
    expect(canTransition("new", "acknowledged")).toBe(true);
    expect(canTransition("new", "resolved")).toBe(true);
    expect(canTransition("new", "dismissed")).toBe(true);
    expect(canTransition("acknowledged", "resolved")).toBe(true);
  });

  it("never returns to `new`, which would falsely claim nobody had looked", () => {
    expect(canTransition("acknowledged", "new")).toBe(false);
    expect(canTransition("resolved", "new")).toBe(false);
    expect(canTransition("dismissed", "new")).toBe(false);
  });

  it("allows reopening a resolved item", () => {
    expect(canTransition("resolved", "acknowledged")).toBe(true);
  });

  it("treats dismissed as terminal", () => {
    for (const to of STATUSES) {
      expect(canTransition("dismissed", to)).toBe(false);
    }
  });

  it("rejects a no-op transition", () => {
    for (const s of STATUSES) expect(canTransition(s, s)).toBe(false);
  });
});

describe("shouldAutoHide", () => {
  it("fires at the threshold, not before", () => {
    expect(shouldAutoHide(AUTO_HIDE_REPORTS - 1)).toBe(false);
    expect(shouldAutoHide(AUTO_HIDE_REPORTS)).toBe(true);
    expect(shouldAutoHide(AUTO_HIDE_REPORTS + 5)).toBe(true);
  });
});

describe("authorDisplayName", () => {
  it("prefers displayName, then name, then a stable fallback", () => {
    expect(authorDisplayName(AUTHOR)).toBe("Ffion");
    expect(authorDisplayName({ ...AUTHOR, displayName: null, name: "Ff" })).toBe("Ff");
    expect(authorDisplayName({ ...AUTHOR, displayName: null, name: null })).toBe(
      "Spotter user-a",
    );
  });
});

describe("isVisibleTo", () => {
  it("shows an unhidden comment to everyone, including signed-out", () => {
    const r = row();
    for (const v of [STRANGER, OWNER, ADMIN, SIGNED_OUT]) {
      expect(isVisibleTo(r, v)).toBe(true);
    }
  });

  it("hides a hidden comment from strangers and signed-out viewers", () => {
    const r = row({ hiddenAt: new Date() });
    expect(isVisibleTo(r, STRANGER)).toBe(false);
    expect(isVisibleTo(r, SIGNED_OUT)).toBe(false);
  });

  it("still shows a hidden comment to its author and to admins", () => {
    const r = row({ hiddenAt: new Date() });
    expect(isVisibleTo(r, OWNER)).toBe(true);
    expect(isVisibleTo(r, ADMIN)).toBe(true);
  });
});

describe("toPublicComment", () => {
  it("never emits an internal or identifying field (INV-2)", () => {
    // A row carrying every internal column the schema has. If someone adds a
    // column and forgets to strip it, this fails — that is the whole point of
    // routing all serialisation through one explicitly-constructed function.
    const fullRow = {
      ...row(),
      adminNote: "spotter seems unreliable, watch this one",
      hiddenReason: "blocklist: profanity",
      hiddenBy: "staff@pebl-cic.co.uk",
      handledBy: "staff@pebl-cic.co.uk",
      handledAt: new Date(),
      readAt: new Date(),
      outcome: "no-action",
      status: "acknowledged",
      updatedAt: new Date(),
      snippetId: "snip-1",
    } as CommentRowLike;

    const authorWithSecrets = {
      ...AUTHOR,
      email: "ffion@example.com",
      emailVerified: new Date(),
      passwordHash: "$2b$10$notarealhash",
    } as CommentAuthorLike;

    const out = toPublicComment(fullRow, authorWithSecrets, ADMIN);
    const serialised = JSON.stringify(out);

    for (const leak of [
      "adminNote",
      "hiddenReason",
      "hiddenBy",
      "handledBy",
      "handledAt",
      "readAt",
      "outcome",
      "status",
      "email",
      "emailVerified",
      "passwordHash",
    ]) {
      expect(Object.keys(out), `leaked key ${leak}`).not.toContain(leak);
      expect(serialised, `leaked value for ${leak}`).not.toContain(leak);
    }
    // And the actual secret values, not just the key names.
    expect(serialised).not.toContain("ffion@example.com");
    expect(serialised).not.toContain("notarealhash");
    expect(serialised).not.toContain("seems unreliable");
  });

  it("exposes reportCount to admins only", () => {
    const r = row({ reportCount: 4 });
    expect(toPublicComment(r, AUTHOR, ADMIN).reportCount).toBe(4);
    expect(toPublicComment(r, AUTHOR, STRANGER).reportCount).toBeNull();
    expect(toPublicComment(r, AUTHOR, OWNER).reportCount).toBeNull();
  });

  it("marks the viewer's own comment", () => {
    expect(toPublicComment(row(), AUTHOR, OWNER).isMine).toBe(true);
    expect(toPublicComment(row(), AUTHOR, STRANGER).isMine).toBe(false);
    expect(toPublicComment(row(), AUTHOR, SIGNED_OUT).isMine).toBe(false);
  });

  it("carries the PEBL flag so staff answers are distinguishable", () => {
    expect(toPublicComment(row(), PEBL_AUTHOR, STRANGER).isPebl).toBe(true);
    expect(toPublicComment(row(), AUTHOR, STRANGER).isPebl).toBe(false);
  });

  it("falls back to the default reason for an unrecognised stored value", () => {
    expect(toPublicComment(row({ reason: "banana" }), AUTHOR, STRANGER).reason).toBe("note");
  });

  it("masks profanity for public viewers, including the author (2026-08-02)", () => {
    const r = row({ body: "can't see a fucking thing in this one" });
    for (const v of [STRANGER, OWNER, SIGNED_OUT]) {
      const out = toPublicComment(r, AUTHOR, v);
      expect(out.body).toBe("can't see a ******* thing in this one");
      expect(out.wasMasked).toBe(true);
    }
  });

  it("gives admins the original text, because they moderate on it", () => {
    const r = row({ body: "can't see a fucking thing in this one" });
    const out = toPublicComment(r, AUTHOR, ADMIN);
    expect(out.body).toBe("can't see a fucking thing in this one");
    expect(out.wasMasked).toBe(false);
  });

  it("masks suggestedName on the same door", () => {
    const r = row({ body: "clean body", suggestedName: "shit fish" });
    expect(toPublicComment(r, AUTHOR, STRANGER).suggestedName).toBe("**** fish");
    expect(toPublicComment(r, AUTHOR, ADMIN).suggestedName).toBe("shit fish");
  });

  it("leaves a clean comment untouched and flags nothing", () => {
    const out = toPublicComment(row({ body: "Lovely little corkwing" }), AUTHOR, STRANGER);
    expect(out.body).toBe("Lovely little corkwing");
    expect(out.wasMasked).toBe(false);
  });

  it("masks a held comment too, in the author's own view of it", () => {
    // A hold-tier hit hides the comment, but the author still sees it. If it
    // ALSO contains mask-tier profanity, their copy is masked like anyone
    // else's — the two tiers compose rather than one shadowing the other.
    const r = row({ body: "shit, what a slut", hiddenAt: new Date() });
    expect(toPublicComment(r, AUTHOR, OWNER).body).toBe("****, what a slut");
    expect(toPublicComment(r, AUTHOR, ADMIN).body).toBe("shit, what a slut");
  });

  it("serialises createdAt as an ISO string", () => {
    expect(toPublicComment(row(), AUTHOR, STRANGER).createdAt).toBe(
      "2026-08-01T10:00:00.000Z",
    );
  });
});

describe("publicAuthorName / isAnonymised — leaderboardOptIn extended to comments", () => {
  // Declared minors (13-17) default leaderboardOptIn=false at signup, which
  // already hides their real name from the public leaderboard. This closes the
  // gap: without it, that same minor's real name would still be shown publicly
  // on every comment they post — an inconsistency, not a hypothetical one.

  it("shows the real name to strangers when the author is opted in (the common case)", () => {
    expect(publicAuthorName(AUTHOR, STRANGER)).toBe("Ffion");
    expect(toPublicComment(row(), AUTHOR, STRANGER).isAnonymised).toBe(false);
  });

  it("anonymises an opted-out author's name for a stranger", () => {
    expect(publicAuthorName(OPTED_OUT_AUTHOR, STRANGER)).toBe("Spotter user-m");
    const out = toPublicComment(row({ userId: OPTED_OUT_AUTHOR.id }), OPTED_OUT_AUTHOR, STRANGER);
    expect(out.authorName).toBe("Spotter user-m");
    expect(out.isAnonymised).toBe(true);
    // The real name must not be recoverable from the payload at all.
    expect(JSON.stringify(out)).not.toContain("Jamie");
  });

  it("lets an opted-out author see their OWN real name on their own comment", () => {
    const owner: Viewer = { userId: OPTED_OUT_AUTHOR.id, isAdmin: false };
    expect(publicAuthorName(OPTED_OUT_AUTHOR, owner)).toBe("Jamie");
  });

  it("still lets staff see the real name, for moderation", () => {
    expect(publicAuthorName(OPTED_OUT_AUTHOR, ADMIN)).toBe("Jamie");
  });

  it("anonymises for a signed-out viewer just the same as a stranger", () => {
    expect(publicAuthorName(OPTED_OUT_AUTHOR, SIGNED_OUT)).toBe("Spotter user-m");
  });
});

describe("threadShape", () => {
  const at = (iso: string) => new Date(iso);

  function input(over: Partial<CommentRowLike>, author = AUTHOR): ThreadInput {
    return { row: row(over), author };
  }

  it("nests a reply under its parent", () => {
    const thread = threadShape(
      [
        input({ id: "a", createdAt: at("2026-08-01T10:00:00Z") }),
        input({ id: "b", parentId: "a", createdAt: at("2026-08-01T11:00:00Z") }),
      ],
      STRANGER,
    );
    expect(thread).toHaveLength(1);
    expect(thread[0].id).toBe("a");
    expect(thread[0].replies.map((r) => r.id)).toEqual(["b"]);
  });

  it("flattens a reply-to-a-reply up to the same level", () => {
    const thread = threadShape(
      [
        input({ id: "a", createdAt: at("2026-08-01T10:00:00Z") }),
        input({ id: "b", parentId: "a", createdAt: at("2026-08-01T11:00:00Z") }),
        input({ id: "c", parentId: "b", createdAt: at("2026-08-01T12:00:00Z") }),
      ],
      STRANGER,
    );
    expect(thread).toHaveLength(1);
    expect(thread[0].replies.map((r) => r.id)).toEqual(["b", "c"]);
    // Depth is capped at one: nothing nests below a reply.
    for (const reply of thread[0].replies) expect(reply.replies).toEqual([]);
  });

  it("orders both levels oldest-first so it reads as a conversation", () => {
    const thread = threadShape(
      [
        input({ id: "second", createdAt: at("2026-08-01T12:00:00Z") }),
        input({ id: "first", createdAt: at("2026-08-01T10:00:00Z") }),
        input({ id: "r2", parentId: "first", createdAt: at("2026-08-01T15:00:00Z") }),
        input({ id: "r1", parentId: "first", createdAt: at("2026-08-01T11:00:00Z") }),
      ],
      STRANGER,
    );
    expect(thread.map((c) => c.id)).toEqual(["first", "second"]);
    expect(thread[0].replies.map((c) => c.id)).toEqual(["r1", "r2"]);
  });

  it("drops comments the viewer may not see", () => {
    const inputs = [
      input({ id: "a", createdAt: at("2026-08-01T10:00:00Z") }),
      input({ id: "held", hiddenAt: new Date(), createdAt: at("2026-08-01T11:00:00Z") }),
    ];
    expect(threadShape(inputs, STRANGER).map((c) => c.id)).toEqual(["a"]);
    // The author and staff still see their own held comment.
    expect(threadShape(inputs, OWNER).map((c) => c.id)).toEqual(["a", "held"]);
    expect(threadShape(inputs, ADMIN).map((c) => c.id)).toEqual(["a", "held"]);
  });

  it("promotes an orphaned reply rather than silently dropping it", () => {
    // The parent is hidden, so a stranger can't see it. The reply itself was not
    // moderated, so it must still appear rather than vanishing with its parent.
    const inputs = [
      input({ id: "parent", hiddenAt: new Date(), createdAt: at("2026-08-01T10:00:00Z") }),
      input({ id: "child", parentId: "parent", createdAt: at("2026-08-01T11:00:00Z") }),
    ];
    const thread = threadShape(inputs, STRANGER);
    expect(thread.map((c) => c.id)).toEqual(["child"]);
    expect(thread[0].replies).toEqual([]);
  });

  it("does not spin on a malformed parent cycle", () => {
    const inputs = [
      input({ id: "x", parentId: "y", createdAt: at("2026-08-01T10:00:00Z") }),
      input({ id: "y", parentId: "x", createdAt: at("2026-08-01T11:00:00Z") }),
    ];
    // The contract here is only that it terminates and returns something sane.
    const thread = threadShape(inputs, STRANGER);
    expect(Array.isArray(thread)).toBe(true);
  });

  it("returns an empty thread for no input", () => {
    expect(threadShape([], STRANGER)).toEqual([]);
  });
});
