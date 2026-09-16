import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrizeCard } from "./PrizeCard";
import type { PrizeClaimStatus, PrizeRequirement } from "@/lib/prize-requirements";
import { GUEST_SAVED_EVENT, GUEST_SAVE_REQUEST_EVENT } from "@/lib/guest";

// Functional smoke for the prize card: progress / checklist / claimable /
// gated / claimed / signed-out states, the two checklist actions and the claim
// flow against a mocked API. Animations are a visual concern; this guards the
// component contract they decorate.

const RULES = "To claim it you also need a confirmed email address and at least 5 separate spotting days, spread over 14 days or more.";

const MET: Record<"pebbles" | "account" | "days" | "span", PrizeRequirement> = {
  pebbles: { id: "pebbles", met: true, label: "Earn 2,000 Pebbles", detail: null, action: null },
  account: { id: "account", met: true, label: "Email confirmed", detail: null, action: null },
  days: { id: "days", met: true, label: "Spot on 5 separate days", detail: null, action: null },
  span: { id: "span", met: true, label: "Spread them over at least 14 days", detail: null, action: null },
};

const UNVERIFIED: PrizeRequirement = {
  id: "account",
  met: false,
  label: "Confirm your email address",
  detail: "We'll email you a link to click.",
  action: "verify-email",
};

const GUEST: PrizeRequirement = {
  id: "account",
  met: false,
  label: "Save your account with an email",
  detail: "Prizes go by post, so we need a way to reach you.",
  action: "save-account",
};

function status(
  overrides: Partial<Record<keyof typeof MET, PrizeRequirement>> = {},
  extra: Partial<PrizeClaimStatus> = {},
): PrizeClaimStatus {
  const requirements = (["pebbles", "account", "days", "span"] as const).map(
    (id) => overrides[id] ?? MET[id],
  );
  const eligible = requirements.filter((r) => r.id !== "pebbles").every((r) => r.met);
  return { eligible, requirements, trustPending: false, ...extra };
}

function renderCard(overrides: Partial<Parameters<typeof PrizeCard>[0]> = {}) {
  return render(
    <PrizeCard
      authed
      initialEarned={260}
      initiallyClaimed={false}
      status={status({
        pebbles: { ...MET.pebbles, met: false, detail: "260 so far" },
      })}
      rulesSummary={RULES}
      {...overrides}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrizeCard", () => {
  it("shows progress toward the target while short of it, with no claim button", () => {
    renderCard();
    expect(screen.getByText(/Win the Seasearch marine life ID guide/)).toBeInTheDocument();
    expect(screen.getByText(/260 of 2,000/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
  });

  it("lists the other claim rules long before the target, without repeating the Pebbles", () => {
    renderCard({
      status: status({
        pebbles: { ...MET.pebbles, met: false, detail: "260 so far" },
        account: UNVERIFIED,
        days: { ...MET.days, met: false, detail: "2 of 5 so far" },
        span: { ...MET.span, met: false, detail: "Your first and latest spots are 3 days apart so far." },
      }),
    });
    expect(screen.getByText("Also needed to claim")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).queryByText(/Earn 2,000 Pebbles/)).not.toBeInTheDocument();
    expect(within(list).getByText("2 of 5 so far")).toBeInTheDocument();
    expect(within(list).getByText(/3 days apart/)).toBeInTheDocument();
    expect(within(list).getAllByText(/Still to do:/)).toHaveLength(3);
  });

  it("offers the claim once the target is reached and every rule is met", () => {
    renderCard({ initialEarned: 2400, status: status() });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeEnabled();
    expect(screen.getAllByText(/^Done:/)).toHaveLength(3);
  });

  it("disables the claim while a listed rule is unmet, and says which", () => {
    renderCard({ initialEarned: 2400, status: status({ account: UNVERIFIED }) });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeDisabled();
    expect(screen.getByText("Confirm your email address")).toBeInTheDocument();
    expect(screen.queryByText(/Almost there/)).not.toBeInTheDocument();
  });

  it("says 'almost there' without naming trust when only the hidden gate remains", () => {
    renderCard({
      initialEarned: 2400,
      status: status({}, { eligible: false, trustPending: true }),
    });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeDisabled();
    const note = screen.getByText(/Almost there/);
    expect(note.textContent).not.toMatch(/trust/i);
  });

  it("sends a confirmation link from the checklist and reports it in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    renderCard({ status: status({ account: UNVERIFIED }) });

    await userEvent.click(screen.getByRole("button", { name: "Send me the link" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/verify-request", { method: "POST" });
    expect(await screen.findByRole("button", { name: "Link sent" })).toBeDisabled();
    expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument();
  });

  it("tells the truth when the link could not be sent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    renderCard({ status: status({ account: UNVERIFIED }) });
    await userEvent.click(screen.getByRole("button", { name: "Send me the link" }));
    expect(await screen.findByRole("button", { name: "Could not send" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/verify you by hand/);
  });

  it("asks a guest to save their account, then moves them on to confirming it", async () => {
    const requested = vi.fn();
    window.addEventListener(GUEST_SAVE_REQUEST_EVENT, requested);
    try {
      renderCard({ status: status({ account: GUEST }) });
      await userEvent.click(screen.getByRole("button", { name: "Add my email" }));
      expect(requested).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(new CustomEvent(GUEST_SAVED_EVENT, { detail: { emailSent: true } }));
      });
      expect(screen.queryByRole("button", { name: "Add my email" })).not.toBeInTheDocument();
      expect(screen.getByText("Confirm your email address")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send a confirmation link" })).toBeInTheDocument();
    } finally {
      window.removeEventListener(GUEST_SAVE_REQUEST_EVENT, requested);
    }
  });

  it("shows the claimed state, with no checklist", () => {
    renderCard({ initialEarned: 2400, initiallyClaimed: true, status: status({ account: UNVERIFIED }) });
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
    expect(screen.queryByText("Also needed to claim")).not.toBeInTheDocument();
  });

  it("shows the fallback illustration while no gallery file loads", () => {
    // jsdom's Image() never fires onload/onerror, so the probe never settles,
    // the same rendered state as production before any screenshot is uploaded.
    renderCard();
    expect(
      screen.getByRole("img", {
        name: "Illustration of a fold-out marine identification guide",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("shows the guide gallery and flicks to the next page once files load", async () => {
    // Probing uses detached Image() objects; stub them to load instantly so
    // every manifest slot resolves, production once screenshots exist.
    class InstantImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", InstantImage);

    renderCard();
    expect(
      await screen.findByRole("img", { name: "Seasearch guide, front cover" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      await screen.findByRole("img", { name: "Seasearch guide, inside page 1" }),
    ).toBeInTheDocument();
  });

  it("sends signed-out visitors to sign in, and states the other rules up front", () => {
    renderCard({ authed: false, initialEarned: 0, status: null });
    expect(screen.getByRole("link", { name: "Sign in and start earning" })).toBeInTheDocument();
    expect(screen.getByText(RULES)).toBeInTheDocument();
    expect(screen.queryByText("Also needed to claim")).not.toBeInTheDocument();
  });

  it("claims: calls the API, flips to Claimed, confirms delivery in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, itemId: "seasearch-guide" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCard({ initialEarned: 2400, status: status() });
    await userEvent.click(screen.getByRole("button", { name: "Claim your guide" }));

    await waitFor(() => {
      expect(screen.getByText("Claimed")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/prize/claim", { method: "POST" });
    expect(
      screen.getByText("Claimed! PEBL will email you to arrange delivery."),
    ).toBeInTheDocument();
  });

  it("surfaces a server rejection as an alert without flipping state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Prize claims unlock with a bit more spotting history." }),
      }),
    );

    renderCard({ initialEarned: 2400, status: status() });
    await userEvent.click(screen.getByRole("button", { name: "Claim your guide" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/more spotting history/);
    });
    expect(screen.queryByText("Claimed")).not.toBeInTheDocument();
  });

  it("leaves the claim to the server when there is no precomputed status", () => {
    renderCard({ initialEarned: 2400, status: null });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeEnabled();
  });
});
