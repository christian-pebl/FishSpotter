import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  AGE_UNKNOWN,
  OPTIONAL_EMAIL_BANDS,
  PUBLICLY_NAMED_WHERE,
  canAttachOwnEmail,
  canBePubliclyNamed,
  canChooseLeaderboardVisibility,
  canPostComments,
  canReceiveOptionalEmail,
  canReceiveStreakNudge,
  canRecordAccountAnalytics,
  canUseAiChat,
  defaultLeaderboardOptIn,
  isAdult,
  isAgeKnown,
  isMinor,
  isPlaceholderEmail,
  isUnder13,
  parseAgeBand,
  placeholderEmail,
  prizeNeedsParentConsent,
  toAgeBandOrUnknown,
} from "./age";

const UNKNOWNS = [null, undefined, "", AGE_UNKNOWN, "12", "adult", "UNDER_13"];

describe("parsing", () => {
  it("accepts exactly the three bands", () => {
    for (const b of AGE_BANDS) expect(parseAgeBand(b)).toBe(b);
    for (const u of UNKNOWNS) expect(parseAgeBand(u)).toBeNull();
  });

  it("maps anything else to unknown for the session", () => {
    expect(toAgeBandOrUnknown("13_17")).toBe("13_17");
    expect(toAgeBandOrUnknown(null)).toBe(AGE_UNKNOWN);
    expect(toAgeBandOrUnknown("18")).toBe(AGE_UNKNOWN);
  });
});

describe("band predicates", () => {
  it("counts under-13s as minors, and unknown as neither", () => {
    expect(isMinor("under_13")).toBe(true);
    expect(isMinor("13_17")).toBe(true);
    expect(isMinor("18_plus")).toBe(false);
    expect(isUnder13("under_13")).toBe(true);
    expect(isAdult("18_plus")).toBe(true);
    for (const u of UNKNOWNS) {
      expect(isMinor(u)).toBe(false);
      expect(isAdult(u)).toBe(false);
      expect(isAgeKnown(u)).toBe(false);
    }
  });
});

describe("what each band may do", () => {
  const table: Array<[string, Record<string, boolean>]> = [
    [
      "under_13",
      {
        leaderboardDefault: false,
        chooseVisibility: false,
        comment: false,
        optionalEmail: false,
        streakNudge: false,
        analytics: false,
        aiChat: false,
        prizeNeedsParent: true,
        ownEmail: false,
      },
    ],
    [
      "13_17",
      {
        leaderboardDefault: false,
        chooseVisibility: true,
        comment: true,
        optionalEmail: true,
        streakNudge: false,
        analytics: true,
        aiChat: false,
        prizeNeedsParent: true,
        ownEmail: true,
      },
    ],
    [
      "18_plus",
      {
        leaderboardDefault: true,
        chooseVisibility: true,
        comment: true,
        optionalEmail: true,
        streakNudge: true,
        analytics: true,
        aiChat: true,
        prizeNeedsParent: false,
        ownEmail: true,
      },
    ],
    [
      AGE_UNKNOWN,
      {
        leaderboardDefault: false,
        chooseVisibility: false,
        comment: false,
        optionalEmail: false,
        streakNudge: false,
        analytics: false,
        aiChat: false,
        prizeNeedsParent: false,
        ownEmail: false,
      },
    ],
  ];

  it.each(table)("%s", (b, expected) => {
    expect({
      leaderboardDefault: defaultLeaderboardOptIn(b),
      chooseVisibility: canChooseLeaderboardVisibility(b),
      comment: canPostComments(b),
      optionalEmail: canReceiveOptionalEmail(b),
      streakNudge: canReceiveStreakNudge(b),
      analytics: canRecordAccountAnalytics(b),
      aiChat: canUseAiChat(b),
      prizeNeedsParent: prizeNeedsParentConsent(b),
      ownEmail: canAttachOwnEmail(b),
    }).toEqual(expected);
  });
});

describe("public naming", () => {
  it("never names an under-13 or an unasked spotter, whatever the stored setting", () => {
    expect(canBePubliclyNamed({ ageBracket: "under_13", leaderboardOptIn: true })).toBe(false);
    expect(canBePubliclyNamed({ ageBracket: null, leaderboardOptIn: true })).toBe(false);
    expect(canBePubliclyNamed({ ageBracket: undefined, leaderboardOptIn: true })).toBe(false);
  });

  it("names a 13-17 or an adult only when they have it switched on", () => {
    expect(canBePubliclyNamed({ ageBracket: "13_17", leaderboardOptIn: true })).toBe(true);
    expect(canBePubliclyNamed({ ageBracket: "13_17", leaderboardOptIn: false })).toBe(false);
    expect(canBePubliclyNamed({ ageBracket: "18_plus", leaderboardOptIn: true })).toBe(true);
    expect(canBePubliclyNamed({ ageBracket: "18_plus", leaderboardOptIn: false })).toBe(false);
  });

  it("agrees with the Prisma where fragment for every combination", () => {
    const matchesWhere = (u: { ageBracket: string | null; leaderboardOptIn: boolean }) =>
      u.leaderboardOptIn === PUBLICLY_NAMED_WHERE.leaderboardOptIn &&
      (PUBLICLY_NAMED_WHERE.ageBracket.in as readonly string[]).includes(u.ageBracket ?? "");
    for (const ageBracket of [...AGE_BANDS, null]) {
      for (const leaderboardOptIn of [true, false]) {
        const u = { ageBracket, leaderboardOptIn };
        expect(matchesWhere(u)).toBe(canBePubliclyNamed(u));
      }
    }
  });

  it("keeps the optional-email band list in step with the predicate", () => {
    for (const b of AGE_BANDS) {
      expect((OPTIONAL_EMAIL_BANDS as readonly string[]).includes(b)).toBe(
        canReceiveOptionalEmail(b),
      );
    }
  });
});

describe("placeholder addresses", () => {
  it("recognises the synthetic guest domain and nothing else", () => {
    const addr = placeholderEmail("abc-123");
    expect(addr).toBe("guest_abc-123@guest.fishspotter.local");
    expect(isPlaceholderEmail(addr)).toBe(true);
    expect(isPlaceholderEmail("GUEST_X@Guest.FishSpotter.Local")).toBe(true);
    expect(isPlaceholderEmail("someone@fishspotter.local.example.com")).toBe(false);
    expect(isPlaceholderEmail("kid@school.org")).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
  });
});
