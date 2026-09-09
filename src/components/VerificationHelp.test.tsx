import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationHelp, verificationStatusFromResponse } from "./VerificationHelp";
import { SUPPORT_EMAIL } from "@/lib/email/outcome";

/**
 * The line under every resend button. What matters is that each status says
 * the truthful next step and that the failure states carry a human to email,
 * because the spotter this was written for (8 Sep 2026) had neither.
 */

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe("verificationStatusFromResponse", () => {
  it("maps the resend endpoint's answers onto the statuses the help line explains", () => {
    expect(verificationStatusFromResponse(response(200))).toBe("sent");
    expect(verificationStatusFromResponse(response(429))).toBe("rate-limited");
    // 503 is "nothing left": provider unconfigured or refusing, not a blip.
    expect(verificationStatusFromResponse(response(503))).toBe("unavailable");
    expect(verificationStatusFromResponse(response(500))).toBe("error");
    expect(verificationStatusFromResponse(response(401))).toBe("error");
  });
});

describe("VerificationHelp", () => {
  it("after a real send, says where to look first and who to email if it never comes", () => {
    render(<VerificationHelp status="sent" />);
    expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: SUPPORT_EMAIL });
    expect(link).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is an alert with a human way out when nothing could be sent", () => {
    render(<VerificationHelp status="unavailable" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/could not send/i);
    expect(alert).toHaveTextContent(SUPPORT_EMAIL);
    expect(alert).toHaveTextContent(/verify you by hand/i);
  });

  it("names the support address in every state that can leave someone stuck", () => {
    for (const status of ["rate-limited", "error"] as const) {
      const { unmount } = render(<VerificationHelp status={status} />);
      expect(screen.getByRole("link", { name: SUPPORT_EMAIL })).toBeInTheDocument();
      unmount();
    }
  });

  it("shows the not-arrived hint before anything is pressed, unless told to stay quiet", () => {
    const { unmount } = render(<VerificationHelp status="idle" />);
    expect(screen.getByText(/not arrived\?/i)).toBeInTheDocument();
    unmount();

    const { container } = render(<VerificationHelp status="idle" showIdleHint={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing while a send is in flight", () => {
    const { container } = render(<VerificationHelp status="sending" />);
    expect(container).toBeEmptyDOMElement();
  });
});
