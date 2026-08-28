import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CommentBox } from "./CommentBox";
import { CommentThread } from "./CommentThread";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function mockFetch(payload: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CommentBox guest gate (INV-4 at the UI layer)", () => {
  it("offers signup instead of a composer for guests", () => {
    render(<CommentBox snippetId="s1" isGuest signUpHref="/auth/signin?x=1" />);

    expect(screen.getByText(/create a free profile/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up free/i })).toBeInTheDocument();
    // The composer must not be reachable at all — not merely disabled.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("gives a real account the composer", () => {
    render(<CommentBox snippetId="s1" isGuest={false} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeInTheDocument();
  });

  it("disables Post until something has been typed", () => {
    render(<CommentBox snippetId="s1" isGuest={false} />);
    expect(screen.getByRole("button", { name: /^post$/i })).toBeDisabled();
  });
});

describe("CommentThread gating (INV-1 at the UI layer)", () => {
  it("shows the unlock prompt and no thread when the server says gated", async () => {
    mockFetch({ gated: true });
    render(<CommentThread snippetId="s1" signedIn isGuest={false} />);

    await waitFor(() =>
      expect(screen.getByText(/make your call to unlock/i)).toBeInTheDocument(),
    );
    // No composer and no comment count leak through the gate.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/comment/i)).not.toBeInTheDocument();
  });

  it("renders collapsed once unlocked, so it can't bury the Next button", async () => {
    mockFetch({
      gated: false,
      total: 2,
      comments: [
        {
          id: "c1",
          parentId: null,
          reason: "note",
          body: "Looks like a juvenile.",
          suggestedName: null,
          authorId: "u1",
          authorName: "Ffion",
          isAnonymised: false,
          isPebl: false,
          isMine: false,
          isHidden: false,
          reportCount: null,
          createdAt: new Date().toISOString(),
          replies: [],
        },
      ],
    });

    render(<CommentThread snippetId="s1" signedIn isGuest={false} />);

    const toggle = await screen.findByRole("button", { name: /2 comments/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Body text stays hidden until the spotter opts in to reading.
    expect(screen.queryByText("Looks like a juvenile.")).not.toBeInTheDocument();
  });
});
