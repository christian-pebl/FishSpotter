import { describe, expect, it } from "vitest";
import { describeMissingEmailConfig, getEmailConfig, isEmailConfigured } from "./client";

describe("getEmailConfig", () => {
  it("is configured only when both the key and a from address are present and non-blank", () => {
    expect(
      isEmailConfigured({ SENDGRID_API_KEY: "SG.x", EMAIL_FROM_ADDRESS: "noreply@fishspotter.app" }),
    ).toBe(true);
    expect(isEmailConfigured({ SENDGRID_API_KEY: "SG.x" })).toBe(false);
    expect(isEmailConfigured({ EMAIL_FROM_ADDRESS: "noreply@fishspotter.app" })).toBe(false);
    // A blank value is the same as an unset one: it cannot send anything.
    expect(
      isEmailConfigured({ SENDGRID_API_KEY: "   ", EMAIL_FROM_ADDRESS: "noreply@fishspotter.app" }),
    ).toBe(false);
    expect(isEmailConfigured({})).toBe(false);
  });

  it("names exactly what is missing, in a sentence a log line can carry", () => {
    expect(getEmailConfig({}).missing).toEqual(["SENDGRID_API_KEY", "EMAIL_FROM_ADDRESS"]);
    expect(getEmailConfig({ SENDGRID_API_KEY: "SG.x" }).missing).toEqual(["EMAIL_FROM_ADDRESS"]);
    expect(
      getEmailConfig({ SENDGRID_API_KEY: "SG.x", EMAIL_FROM_ADDRESS: "noreply@fishspotter.app" })
        .missing,
    ).toEqual([]);
    expect(describeMissingEmailConfig(["EMAIL_FROM_ADDRESS"])).toBe(
      "Email is not configured (EMAIL_FROM_ADDRESS not set)",
    );
  });

  it("trims values, defaults the sender name, and leaves reply-to unset when absent", () => {
    const config = getEmailConfig({
      SENDGRID_API_KEY: " SG.x ",
      EMAIL_FROM_ADDRESS: " noreply@fishspotter.app ",
    });
    expect(config.apiKey).toBe("SG.x");
    expect(config.fromAddress).toBe("noreply@fishspotter.app");
    expect(config.fromName).toBe("PEBL FishSpotter");
    expect(config.replyTo).toBeNull();

    expect(
      getEmailConfig({ EMAIL_FROM_NAME: "FishSpotter", EMAIL_REPLY_TO: "hello@pebl-cic.co.uk" }),
    ).toMatchObject({ fromName: "FishSpotter", replyTo: "hello@pebl-cic.co.uk" });
  });

  it("reads the live environment on every call rather than caching a stale answer", () => {
    const before = process.env.SENDGRID_API_KEY;
    const beforeFrom = process.env.EMAIL_FROM_ADDRESS;
    try {
      process.env.SENDGRID_API_KEY = "";
      process.env.EMAIL_FROM_ADDRESS = "";
      expect(isEmailConfigured()).toBe(false);
      process.env.SENDGRID_API_KEY = "SG.now-set";
      process.env.EMAIL_FROM_ADDRESS = "noreply@fishspotter.app";
      expect(isEmailConfigured()).toBe(true);
    } finally {
      if (before === undefined) delete process.env.SENDGRID_API_KEY;
      else process.env.SENDGRID_API_KEY = before;
      if (beforeFrom === undefined) delete process.env.EMAIL_FROM_ADDRESS;
      else process.env.EMAIL_FROM_ADDRESS = beforeFrom;
    }
  });
});
