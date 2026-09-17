import { describe, expect, it } from "vitest";
import {
  AGE_NOTICE_GRACE_MS,
  decideAgeNotice,
  emailDomain,
  formatNoticeDate,
  isRemovalDue,
  isSchoolLikeEmail,
  removalCandidateCutoff,
  removalDateFor,
  ukDay,
  type AgeNoticeTarget,
} from "./age-notice";
import { placeholderEmail } from "./age";

describe("isSchoolLikeEmail", () => {
  it("flags the four domain shapes found on 16 Sep 2026", () => {
    // The real domains from docs/compliance/children.md section 10; the
    // mailbox names are made up.
    for (const email of [
      "a.pupil@ahschools.us",
      "b.pupil@student.scusd.edu",
      "c.pupil@thepegasusschool.org",
      "d.pupil@oakdalechristian.org",
    ]) {
      expect(isSchoolLikeEmail(email), email).toBe(true);
    }
  });

  it("flags other common school shapes", () => {
    for (const email of [
      "x@stmarys.sch.uk",
      "x@lincoln.k12.ca.us",
      "x@example.edu",
      "x@example.edu.au",
      "x@pupils.example.org",
      "x@oakacademy.org.uk",
      "x@katy.isd.net",
    ]) {
      expect(isSchoolLikeEmail(email), email).toBe(true);
    }
  });

  it("reads the domain only, never the mailbox name", () => {
    expect(isSchoolLikeEmail("christian.student.school@gmail.com")).toBe(false);
    expect(isSchoolLikeEmail("sam@hotmail.co.uk")).toBe(false);
    expect(isSchoolLikeEmail("christian@pebl-cic.co.uk")).toBe(false);
  });

  it("ignores placeholders and missing addresses", () => {
    expect(isSchoolLikeEmail(placeholderEmail("school-1"))).toBe(false);
    expect(isSchoolLikeEmail(null)).toBe(false);
    expect(isSchoolLikeEmail(undefined)).toBe(false);
    expect(isSchoolLikeEmail("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSchoolLikeEmail("A@TheSchool.ORG")).toBe(true);
    expect(emailDomain("A@TheSchool.ORG")).toBe("theschool.org");
  });
});

describe("removal date", () => {
  it("is fourteen days after the notice", () => {
    const sent = new Date("2026-09-16T15:00:00Z");
    expect(AGE_NOTICE_GRACE_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(removalDateFor(sent).toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it("is written as a UK date, in UK time", () => {
    expect(formatNoticeDate(new Date("2026-09-30T15:00:00Z"))).toBe("30 September 2026");
    // 23:30 UTC on 30 Sep is already 1 Oct in London (BST).
    expect(formatNoticeDate(new Date("2026-09-30T23:30:00Z"))).toBe("1 October 2026");
  });
});

describe("isRemovalDue", () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  /** The daily child-data job (vercel.json, 0 5 * * *). */
  const runsFrom = (from: Date) => {
    const first = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 5));
    return Array.from({ length: 40 }, (_, i) => new Date(first.getTime() + i * DAY));
  };

  it("goes on the morning of the date the email gave, not the day after", () => {
    const sent = new Date("2026-09-16T21:01:00Z"); // 22:01 in the UK
    expect(formatNoticeDate(removalDateFor(sent))).toBe("30 September 2026");
    expect(isRemovalDue(sent, new Date("2026-09-29T22:59:00Z"))).toBe(false);
    expect(isRemovalDue(sent, new Date("2026-09-30T05:00:00Z"))).toBe(true);
  });

  it("follows the UK date, not the UTC one", () => {
    const sent = new Date("2026-09-16T23:30:00Z"); // 00:30 on the 17th in the UK
    expect(formatNoticeDate(removalDateFor(sent))).toBe("1 October 2026");
    expect(isRemovalDue(sent, new Date("2026-09-30T05:00:00Z"))).toBe(false);
    expect(isRemovalDue(sent, new Date("2026-10-01T05:00:00Z"))).toBe(true);
  });

  it("always removes on the stated date, across the October clock change", () => {
    // Every hour for a fortnight, so removal dates straddle 25 Oct 2026.
    const start = Date.parse("2026-10-05T00:00:00Z");
    for (let t = start; t < start + 15 * DAY; t += HOUR) {
      const sent = new Date(t);
      const firstDue = runsFrom(sent).find((run) => run > sent && isRemovalDue(sent, run));
      expect(firstDue, sent.toISOString()).toBeDefined();
      expect(ukDay(firstDue!), sent.toISOString()).toBe(ukDay(removalDateFor(sent)));
      expect(formatNoticeDate(firstDue!)).toBe(formatNoticeDate(removalDateFor(sent)));
      // The database pre-filter never hides a due account.
      expect(sent <= removalCandidateCutoff(firstDue!), sent.toISOString()).toBe(true);
    }
  });

  it("writes the UK day in a sortable form", () => {
    expect(ukDay(new Date("2026-10-25T00:30:00Z"))).toBe("2026-10-25");
    expect(ukDay(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-28");
    expect(ukDay(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
  });
});

describe("decideAgeNotice", () => {
  const target: AgeNoticeTarget = {
    id: "u1",
    email: "c.pupil@thepegasusschool.org",
    displayName: "Sam",
    name: null,
    isGuest: false,
    ageBracket: null,
    ageNoticeSentAt: null,
  };

  it("sends to a saved school-like account that has not given its age", () => {
    expect(decideAgeNotice(target)).toEqual({ send: true });
  });

  it("never sends twice", () => {
    expect(decideAgeNotice({ ...target, ageNoticeSentAt: new Date() })).toEqual({
      send: false,
      reason: "already told",
    });
  });

  it("skips an account whose address has already gone", () => {
    expect(decideAgeNotice({ ...target, isGuest: true })).toMatchObject({ send: false });
    expect(
      decideAgeNotice({ ...target, email: placeholderEmail("abc") }),
    ).toMatchObject({ send: false });
  });

  it("skips an account that has told us its age since the page loaded", () => {
    for (const band of ["under_13", "13_17", "18_plus"]) {
      expect(decideAgeNotice({ ...target, ageBracket: band })).toEqual({
        send: false,
        reason: "has told us their age since",
      });
    }
  });

  it("refuses an address that is not school-like, so the action cannot mail anyone else", () => {
    expect(decideAgeNotice({ ...target, email: "sam@gmail.com" })).toEqual({
      send: false,
      reason: "not a school-like address",
    });
  });

  it("skips a missing account", () => {
    expect(decideAgeNotice(null)).toEqual({ send: false, reason: "account not found" });
  });
});
