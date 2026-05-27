"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

const MAX_LABEL = 60;
const MAX_DESCRIPTION = 280;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampRadius(n: number): number {
  if (!Number.isFinite(n)) return 0.06;
  // 1% min so a misclick can't create an invisible ring, 50% max so a single
  // mark can't swallow the whole photo
  return Math.max(0.01, Math.min(0.5, n));
}

function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, max);
}

function assertScientificName(name: string): void {
  if (!/^[A-Za-z][A-Za-z\- ]{0,80}$/.test(name)) {
    throw new Error("Invalid scientific name");
  }
}

export type CreateMarkInput = {
  scientificName: string;
  speciesImageId: string;
  label: string;
  description: string;
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
};

export async function createMark(input: CreateMarkInput) {
  const { email } = await requireAdminSession();
  const scientificName = input.scientificName.trim();
  assertScientificName(scientificName);

  const label = cleanText(input.label, MAX_LABEL);
  if (!label) throw new Error("Label is required");
  const description = cleanText(input.description, MAX_DESCRIPTION);

  // Confirm the photo belongs to this species — prevents cross-species
  // mark assignment via a tampered ID.
  const photo = await prisma.speciesImage.findUnique({
    where: { id: input.speciesImageId },
    select: { id: true, scientificName: true, curated: true },
  });
  if (!photo || photo.scientificName !== scientificName) {
    throw new Error("Photo not found for this species");
  }
  // Q3A-T4: diagnostic marks only render on curated reference photos.
  // Bouncing this at the action layer keeps the editorial bar visible to
  // admins: if you're about to author a mark on a stock iNat photo,
  // curate it first (add to src/data/species-images.json overrides) so
  // the rest of the team knows this is the canonical reference shot.
  if (!photo.curated) {
    throw new Error(
      "Diagnostic marks can only be attached to curated reference photos. Add this photo to src/data/species-images.json overrides (curated: true) first, then re-run db:refresh-images.",
    );
  }

  // New marks land at the end of the order.
  const max = await prisma.diagnosticMark.aggregate({
    where: { scientificName },
    _max: { order: true },
  });
  const nextOrder = (max._max.order ?? -1) + 1;

  const created = await prisma.diagnosticMark.create({
    data: {
      scientificName,
      speciesImageId: photo.id,
      order: nextOrder,
      label,
      description,
      overlayX: clamp01(input.overlayX),
      overlayY: clamp01(input.overlayY),
      overlayRadius: clampRadius(input.overlayRadius),
      createdBy: email,
    },
  });

  revalidatePath(`/admin/species/${encodeURIComponent(scientificName)}`);
  revalidatePath(`/admin/species`);
  return created;
}

export type UpdateMarkInput = {
  id: string;
  label?: string;
  description?: string;
  overlayX?: number;
  overlayY?: number;
  overlayRadius?: number;
  order?: number;
};

export async function updateMark(input: UpdateMarkInput) {
  await requireAdminSession();

  const existing = await prisma.diagnosticMark.findUnique({
    where: { id: input.id },
    select: { scientificName: true },
  });
  if (!existing) throw new Error("Mark not found");

  const data: Record<string, unknown> = {};
  if (input.label !== undefined) {
    const label = cleanText(input.label, MAX_LABEL);
    if (!label) throw new Error("Label is required");
    data.label = label;
  }
  if (input.description !== undefined) {
    data.description = cleanText(input.description, MAX_DESCRIPTION);
  }
  if (input.overlayX !== undefined) data.overlayX = clamp01(input.overlayX);
  if (input.overlayY !== undefined) data.overlayY = clamp01(input.overlayY);
  if (input.overlayRadius !== undefined) data.overlayRadius = clampRadius(input.overlayRadius);
  if (input.order !== undefined && Number.isInteger(input.order)) {
    data.order = Math.max(0, input.order);
  }

  const updated = await prisma.diagnosticMark.update({
    where: { id: input.id },
    data,
  });

  revalidatePath(`/admin/species/${encodeURIComponent(existing.scientificName)}`);
  return updated;
}

export async function deleteMark(id: string) {
  await requireAdminSession();
  const existing = await prisma.diagnosticMark.findUnique({
    where: { id },
    select: { scientificName: true },
  });
  if (!existing) return;
  await prisma.diagnosticMark.delete({ where: { id } });
  revalidatePath(`/admin/species/${encodeURIComponent(existing.scientificName)}`);
  revalidatePath(`/admin/species`);
}

// Swap the order of two marks. Used by the up/down arrows in the sidebar
// list. Done as a transaction so the list can never end up with two
// identical order values mid-swap.
export async function swapMarkOrder(aId: string, bId: string) {
  await requireAdminSession();
  if (aId === bId) return;
  const [a, b] = await Promise.all([
    prisma.diagnosticMark.findUnique({ where: { id: aId }, select: { id: true, order: true, scientificName: true } }),
    prisma.diagnosticMark.findUnique({ where: { id: bId }, select: { id: true, order: true, scientificName: true } }),
  ]);
  if (!a || !b || a.scientificName !== b.scientificName) {
    throw new Error("Marks not found or belong to different species");
  }
  await prisma.$transaction([
    prisma.diagnosticMark.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.diagnosticMark.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidatePath(`/admin/species/${encodeURIComponent(a.scientificName)}`);
}
