// @vitest-environment node
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { AgePolicyNoticeEmail } from "./AgePolicyNoticeEmail";

const props = {
  displayName: "Sam",
  removalOn: "30 September 2026",
  appUrl: "https://www.fishspotter.app/feed",
  parentUrl: "https://www.fishspotter.app/parent",
  privacyUrl: "https://www.fishspotter.app/privacy#children",
};

describe("AgePolicyNoticeEmail", () => {
  it("says what changes, when, and that progress is kept", async () => {
    const out = await render(AgePolicyNoticeEmail(props), { plainText: true });
    expect(out).toContain("Hi Sam,");
    expect(out).toContain("remove it from your FishSpotter account on 30 September 2026");
    expect(out).toContain("Your finds and Pebbles will not be lost.");
    expect(out).toContain("https://www.fishspotter.app/feed");
    expect(out).toContain("https://www.fishspotter.app/parent");
    expect(out).toContain("https://www.fishspotter.app/privacy#children");
    expect(out).toContain("hello@pebl-cic.co.uk");
  });

  it("explains the new process", async () => {
    const out = await render(AgePolicyNoticeEmail(props), { plainText: true });
    expect(out).toContain("Everyone is now asked their age group");
    expect(out).toContain("a parent or carer can save their progress");
    expect(out).toContain("before we post them a prize");
    expect(out).toContain("we'll ask your age group");
  });

  it("never asks for an age by reply, and never says which answer keeps the address", async () => {
    const out = await render(AgePolicyNoticeEmail(props), { plainText: true });
    expect(out).not.toMatch(/reply (to|with)/i);
    expect(out).not.toMatch(/keep (your|this) (email|address)/i);
    expect(out).not.toMatch(/if you are (13|over|18)/i);
  });

  it("uses no long dashes", async () => {
    const html = await render(AgePolicyNoticeEmail(props));
    expect(html).not.toMatch(/[\u2013\u2014]/);
  });
});
