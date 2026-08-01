"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import {
  OUTCOME_CODES,
  STATUSES,
  canTransition,
  type CommentStatus,
  type OutcomeCode,
} from "@/lib/comments";

/**
 * Staff actions for the comment inbox + moderation queue.
 *
 * Every action starts with requireAdminSession() (verified @pebl-cic.co.uk),
 * and every status change is validated through canTransition() so the inbox
 * can't be walked into an incoherent state (e.g. back to "new", which would
 * falsely claim nobody had looked at it yet).
 */

const MAX_REPLY = 500;
const MAX_NOTE = 1000;

function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ").slice(0, max);
}

function refresh() {
  revalidatePath("/admin/comments");
  revalidatePath("/admin");
}

async function loadOrThrow(id: string) {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Comment not found");
  return existing;
}

function assertStatus(value: string): CommentStatus {
  if (!(STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown status: ${value}`);
  }
  return value as CommentStatus;
}

/** Mark as seen by staff without replying. */
export async function acknowledgeComment(id: string) {
  const { email } = await requireAdminSession();
  const existing = await loadOrThrow(id);
  const from = assertStatus(existing.status);
  if (!canTransition(from, "acknowledged")) return;

  await prisma.comment.update({
    where: { id },
    data: {
      status: "acknowledged",
      handledBy: email,
      handledAt: new Date(),
      readAt: new Date(),
    },
  });
  refresh();
}

/** Public reply from PEBL, shown to the spotter in the thread. */
export async function replyToComment(id: string, reply: string) {
  const { email } = await requireAdminSession();
  const existing = await loadOrThrow(id);
  const text = cleanText(reply, MAX_REPLY);
  if (!text) throw new Error("Reply is required");

  const from = assertStatus(existing.status);
  const advance = canTransition(from, "acknowledged");

  // The reply itself is posted as a real comment in the thread (authored by the
  // admin's own account) rather than a special field, so spotters see one
  // consistent conversation and the reply can be moderated like anything else.
  const parent = await prisma.comment.findUnique({
    where: { id },
    select: { snippetId: true, parentId: true, id: true },
  });
  if (!parent) throw new Error("Comment not found");

  const admin = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!admin) throw new Error("Admin account not found");

  await prisma.$transaction([
    prisma.comment.create({
      data: {
        userId: admin.id,
        snippetId: parent.snippetId,
        parentId: parent.parentId ?? parent.id,
        reason: "note",
        body: text,
      },
    }),
    prisma.comment.update({
      where: { id },
      data: {
        // NB the reply lives in the thread as its own Comment row (above), not
        // in a field here — so the schema's legacy `adminReply` column stays
        // unused. Kept rather than dropped to avoid a needless prod migration.
        ...(advance ? { status: "acknowledged" } : {}),
        handledBy: email,
        handledAt: new Date(),
        readAt: new Date(),
      },
    }),
  ]);
  refresh();
}

/** Close it out against a real outcome, which is what /admin/metrics counts. */
export async function resolveComment(id: string, outcome: string, note?: string) {
  const { email } = await requireAdminSession();
  const existing = await loadOrThrow(id);
  if (!(OUTCOME_CODES as readonly string[]).includes(outcome)) {
    throw new Error(`Unknown outcome: ${outcome}`);
  }
  const from = assertStatus(existing.status);
  if (!canTransition(from, "resolved")) return;

  await prisma.comment.update({
    where: { id },
    data: {
      status: "resolved",
      outcome: outcome as OutcomeCode,
      adminNote: note ? cleanText(note, MAX_NOTE) : undefined,
      handledBy: email,
      handledAt: new Date(),
      readAt: new Date(),
    },
  });
  refresh();
}

/** Spam or noise. Terminal, and never notifies the spotter. */
export async function dismissComment(id: string) {
  const { email } = await requireAdminSession();
  const existing = await loadOrThrow(id);
  const from = assertStatus(existing.status);
  if (!canTransition(from, "dismissed")) return;

  await prisma.comment.update({
    where: { id },
    data: {
      status: "dismissed",
      handledBy: email,
      handledAt: new Date(),
      readAt: new Date(),
    },
  });
  refresh();
}

export async function hideComment(id: string, reason?: string) {
  const { email } = await requireAdminSession();
  await loadOrThrow(id);
  await prisma.comment.update({
    where: { id },
    data: {
      hiddenAt: new Date(),
      hiddenBy: email,
      hiddenReason: cleanText(reason ?? "staff review", MAX_NOTE),
      readAt: new Date(),
    },
  });
  refresh();
}

export async function unhideComment(id: string) {
  await requireAdminSession();
  await loadOrThrow(id);
  await prisma.comment.update({
    where: { id },
    data: { hiddenAt: null, hiddenBy: null, hiddenReason: null },
  });
  refresh();
}

/** Hard delete. Reserved for illegal content, where hiding is not enough. */
export async function deleteComment(id: string) {
  await requireAdminSession();
  await loadOrThrow(id);
  await prisma.comment.delete({ where: { id } });
  refresh();
}

/** Clears the unread badge when staff open the inbox. */
export async function markAllRead() {
  await requireAdminSession();
  await prisma.comment.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  refresh();
}
