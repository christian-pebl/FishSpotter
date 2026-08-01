import { describe, it, expect } from "vitest";
import { shouldNotify } from "./comment-notify";

/**
 * Only the pure decision is tested here. The network send is deliberately not
 * mocked: sendEmail already no-ops without SENDGRID_API_KEY and never throws, so
 * a mock would test the mock rather than the behaviour that matters.
 */
describe("shouldNotify", () => {
  const base = { isReply: false, parentIsPebl: false, authorIsPebl: false };

  it("notifies on a new top-level comment from a spotter", () => {
    expect(shouldNotify(base)).toBe(true);
  });

  it("notifies when a spotter replies to a PEBL comment", () => {
    expect(shouldNotify({ ...base, isReply: true, parentIsPebl: true })).toBe(true);
  });

  it("stays quiet on ordinary spotter-to-spotter replies", () => {
    // The signal has to survive contact with a real thread. If every reply pages
    // staff, staff stop reading the channel, which is worse than no channel.
    expect(shouldNotify({ ...base, isReply: true, parentIsPebl: false })).toBe(false);
  });

  it("never pages staff about staff's own comments", () => {
    expect(shouldNotify({ ...base, authorIsPebl: true })).toBe(false);
    expect(
      shouldNotify({ isReply: true, parentIsPebl: true, authorIsPebl: true }),
    ).toBe(false);
  });
});
