import { prisma } from "@/lib/prisma";
import { REASON_CODES } from "@/lib/comments";
import { siteLabel } from "@/lib/site-label";
import { CommentInbox, type InboxRow } from "./CommentInbox";

export const dynamic = "force-dynamic";

type Search = { status?: string; reason?: string; view?: string };

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "new";
  const reason = sp.reason ?? "";
  const view = sp.view ?? "";

  const where = {
    ...(view === "reported" ? { reportCount: { gt: 0 } } : {}),
    ...(view === "held" ? { hiddenAt: { not: null } } : {}),
    ...(status && status !== "all" && !view ? { status } : {}),
    ...(reason ? { reason } : {}),
  };

  const [rows, counts] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        body: true,
        reason: true,
        suggestedName: true,
        status: true,
        outcome: true,
        hiddenAt: true,
        hiddenReason: true,
        reportCount: true,
        adminNote: true,
        handledBy: true,
        createdAt: true,
        parentId: true,
        user: { select: { id: true, displayName: true, name: true, isGuest: true } },
        snippet: { select: { id: true, externalId: true, thumbnailUrl: true, site: true } },
      },
    }),
    prisma.comment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // The spotter's own call on that clip, for context next to their comment.
  const answers = await prisma.answer.findMany({
    where: {
      OR: rows.map((r) => ({ userId: r.user.id, snippetId: r.snippet.id })),
    },
    select: { userId: true, snippetId: true, chosenOption: true },
  });
  const answerBy = new Map(
    answers.map((a) => [`${a.userId}:${a.snippetId}`, a.chosenOption]),
  );

  const inboxRows: InboxRow[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    reason: r.reason,
    suggestedName: r.suggestedName,
    status: r.status,
    outcome: r.outcome,
    isHidden: r.hiddenAt !== null,
    hiddenReason: r.hiddenReason,
    reportCount: r.reportCount,
    adminNote: r.adminNote,
    handledBy: r.handledBy,
    createdAt: r.createdAt.toISOString(),
    isReply: r.parentId !== null,
    authorId: r.user.id,
    authorName: r.user.displayName ?? r.user.name ?? `Spotter ${r.user.id.slice(0, 6)}`,
    authorIsGuest: r.user.isGuest,
    snippetId: r.snippet.id,
    snippetLabel: r.snippet.externalId,
    snippetSite: siteLabel(r.snippet.site),
    thumbnailUrl: r.snippet.thumbnailUrl,
    theirAnswer: answerBy.get(`${r.user.id}:${r.snippet.id}`) ?? null,
  }));

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-brand text-h2 text-navy-900">Spotter feedback</h1>
        <p className="pt-1 text-sm text-navy-600">
          Public comments left on clips. Each reason routes to a tool: a missing species goes to
          the catalogue, a bad trail to the track editor, an unclear clip to exclusion. Resolving
          against a real outcome is what makes the impact numbers meaningful.
        </p>
        <p className="pt-2 text-[12px] text-navy-500">
          {countBy.new ?? 0} new · {countBy.acknowledged ?? 0} acknowledged ·{" "}
          {countBy.resolved ?? 0} resolved · {countBy.dismissed ?? 0} dismissed
        </p>
      </header>

      <CommentInbox
        rows={inboxRows}
        activeStatus={view ? "" : status}
        activeReason={reason}
        activeView={view}
        reasons={[...REASON_CODES]}
      />
    </div>
  );
}
