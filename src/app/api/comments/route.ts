import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { isAdminUser } from "@/lib/admin";
import { checkCommentRateLimit } from "@/lib/rate-limit";
import { notifyStaffOfComment, shouldNotify } from "@/lib/email/comment-notify";
import {
  MAX_BODY,
  MAX_SUGGESTED_NAME,
  REASON_CODES,
  canPost,
  containsUrl,
  hitsBlocklist,
  sanitiseBody,
  sanitiseSuggestedName,
  threadShape,
  toPublicComment,
  type CommentAuthorLike,
  type ThreadInput,
  type Viewer,
} from "@/lib/comments";

/**
 * Public per-clip comment thread.
 *
 * GET , the thread, GATED on the caller having answered this clip (INV-1).
 * POST, leave a comment (or a one-level reply).
 *
 * THE GATE IS LOAD-BEARING, NOT POLITENESS. src/lib/consensus.ts pays Pebbles for
 * INDEPENDENT convergence and src/lib/trust.ts propagates reputation through the
 * winning camps, so a thread readable before you commit your own ID would quietly
 * turn consensus into a measurement of copying. This mirrors exactly what
 * GET /api/snippets/[id]/stats already does with the community histogram.
 *
 * Every response body is built by toPublicComment() (src/lib/comments.ts), which
 * constructs its fields explicitly and never spreads a Prisma row, so adminNote
 * and author emails cannot leak (INV-2).
 */
export const dynamic = "force-dynamic";

// Author fields needed to render a comment. `email`/`emailVerified` are selected
// ONLY to compute the PEBL staff badge and are dropped before serialisation.
const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  name: true,
  email: true,
  emailVerified: true,
  leaderboardOptIn: true,
} as const;

type AuthorRow = {
  id: string;
  displayName: string | null;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  leaderboardOptIn: boolean;
};

/** Drops the email fields on the way through, leaving only the badge boolean. */
function toAuthorLike(u: AuthorRow): CommentAuthorLike {
  return {
    id: u.id,
    displayName: u.displayName,
    name: u.name,
    isPebl: isAdminUser({ email: u.email, emailVerified: u.emailVerified }),
    leaderboardOptIn: u.leaderboardOptIn,
  };
}

async function resolveViewer(): Promise<Viewer> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return { userId: null, isAdmin: false };
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  return { userId, isAdmin: isAdminUser(me) };
}

async function hasAnswered(userId: string, snippetId: string): Promise<boolean> {
  const found = await prisma.answer.findFirst({
    where: { userId, snippetId },
    select: { id: true },
  });
  return found !== null;
}

// ---------------------------------------------------------------------------
// GET, the gated thread
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const snippetId = new URL(req.url).searchParams.get("snippetId");
  if (!snippetId) {
    return NextResponse.json({ error: "snippetId required" }, { status: 400 });
  }

  const viewer = await resolveViewer();

  // INV-1. Admins can always read (they moderate). Everyone else must have
  // committed their own call on THIS clip first.
  const unlocked =
    viewer.isAdmin ||
    (viewer.userId !== null && (await hasAnswered(viewer.userId, snippetId)));

  if (!unlocked) {
    // Nothing but the gate flag: no count, no preview, no hint of the content.
    return NextResponse.json({ gated: true });
  }

  const rows = await prisma.comment.findMany({
    where: { snippetId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      parentId: true,
      reason: true,
      body: true,
      suggestedName: true,
      hiddenAt: true,
      reportCount: true,
      createdAt: true,
      user: { select: AUTHOR_SELECT },
    },
  });

  const inputs: ThreadInput[] = rows.map((r) => ({
    row: r,
    author: toAuthorLike(r.user),
  }));

  const comments = threadShape(inputs, viewer);
  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  // NO public Cache-Control: this payload is per-user gated and identity-bearing
  // (isMine, and admin-only reportCount), so the CDN must never share it.
  return NextResponse.json({ gated: false, total, comments });
}

// ---------------------------------------------------------------------------
// POST, leave a comment
// ---------------------------------------------------------------------------

const PostSchema = z.object({
  snippetId: z.string().min(1).max(64),
  body: z.string().min(1).max(MAX_BODY * 2), // sanitiser does the real clamp
  reason: z.enum(REASON_CODES).optional(),
  parentId: z.string().max(64).optional(),
  suggestedName: z.string().max(MAX_SUGGESTED_NAME * 2).optional(),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkCommentRateLimit(userId))) {
    return NextResponse.json(
      { error: "Too many comments in a short window. Take a breath." },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = PostSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { snippetId } = parsed;

  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { id: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  // Posting eligibility: guests are blocked (INV-4, a guest account is a free,
  // unlimited, unverified identity), and you must have made your own call first.
  const [me, answered, existingOnClip] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        isGuest: true,
        displayName: true,
        name: true,
        email: true,
        emailVerified: true,
        leaderboardOptIn: true,
      },
    }),
    hasAnswered(userId, snippetId),
    prisma.comment.count({ where: { userId, snippetId, parentId: null } }),
  ]);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve the parent BEFORE the eligibility gate, because replies are exempt
  // from the per-clip cap (see canPost). Replies are one level deep: a reply to
  // a reply is re-pointed at the top-level ancestor rather than nesting further.
  let parentId: string | null = null;
  if (parsed.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.parentId },
      select: { id: true, snippetId: true, parentId: true },
    });
    if (!parent || parent.snippetId !== snippetId) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
    }
    parentId = parent.parentId ?? parent.id;
  }

  const gate = canPost({
    isGuest: me.isGuest,
    hasAnsweredClip: answered,
    existingOnClip,
    isReply: parentId !== null,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, reason: gate.reason },
      { status: gate.reason === "clip-limit-reached" ? 429 : 403 },
    );
  }

  const body = sanitiseBody(parsed.body);
  if (!body) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }
  if (containsUrl(body)) {
    return NextResponse.json(
      { error: "Links aren't allowed in comments." },
      { status: 400 },
    );
  }

  // A blocklist hit HOLDS the comment for review rather than rejecting it, so a
  // false positive is recoverable by a human instead of silently losing a
  // spotter's contribution. The author still sees their own held comment.
  const blocked = hitsBlocklist(body);

  const reason = parsed.reason ?? "note";
  const suggestedName =
    reason === "not-listed" || reason === "disagree"
      ? sanitiseSuggestedName(parsed.suggestedName) || null
      : null;

  const created = await prisma.comment.create({
    data: {
      userId,
      snippetId,
      parentId,
      reason,
      body,
      suggestedName,
      hiddenAt: blocked ? new Date() : null,
      hiddenReason: blocked ? `blocklist: ${blocked}` : null,
    },
    select: {
      id: true,
      userId: true,
      parentId: true,
      reason: true,
      body: true,
      suggestedName: true,
      hiddenAt: true,
      reportCount: true,
      createdAt: true,
    },
  });

  const viewer: Viewer = {
    userId,
    isAdmin: isAdminUser({ email: me.email, emailVerified: me.emailVerified }),
  };

  // Instant staff notification. Awaited (Next 14 has no after()/waitUntil here)
  // but timeout-wrapped and never-throwing, so it cannot fail or hang the post.
  // Ordinary spotter-to-spotter replies deliberately stay quiet, see shouldNotify.
  let parentIsPebl = false;
  if (parentId) {
    const parentAuthor = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { user: { select: { email: true, emailVerified: true } } },
    });
    parentIsPebl = isAdminUser(parentAuthor?.user);
  }
  if (shouldNotify({ isReply: parentId !== null, parentIsPebl, authorIsPebl: viewer.isAdmin })) {
    const snippetLabel = await prisma.snippet.findUnique({
      where: { id: snippetId },
      select: { externalId: true },
    });
    const theirAnswer = await prisma.answer.findFirst({
      where: { userId, snippetId },
      select: { chosenOption: true },
    });
    await notifyStaffOfComment(prisma, {
      authorName: me.displayName ?? me.name ?? `Spotter ${userId.slice(0, 6)}`,
      reason,
      body,
      suggestedName,
      snippetLabel: snippetLabel?.externalId ?? snippetId,
      theirAnswer: theirAnswer?.chosenOption ?? null,
    });
  }

  return NextResponse.json(
    {
      comment: toPublicComment(
        created,
        toAuthorLike({
          id: userId,
          displayName: me.displayName,
          name: me.name,
          email: me.email,
          emailVerified: me.emailVerified,
          leaderboardOptIn: me.leaderboardOptIn,
        }),
        viewer,
      ),
      // Tells the composer to show "held for review" rather than pretending it
      // is live for everyone.
      held: blocked !== null,
    },
    { status: 201 },
  );
}
