/**
 * Backfill width/height on SpeciesImage rows that are missing them.
 *
 * Why it matters: AnnotatedSpeciesPhoto builds its SVG viewBox from the stored
 * width/height and falls back to a 1000x1000 SQUARE (and a 4/3 container) when
 * they're null. For a landscape photo that square viewBox skews every ring off
 * its feature. Diagnostic-mark coords are normalised 0..1 against the TRUE
 * aspect, so the row must carry the true dimensions for the rings to line up.
 *
 * Reads the real pixel size straight from each JPEG/PNG header (no image lib).
 *
 *   npx tsx --env-file=.env.local scripts/backfill-image-dims.ts            # all null-dim rows
 *   npx tsx --env-file=.env.local scripts/backfill-image-dims.ts -- --marked-only
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte sig, then IHDR width@16 height@20 (big-endian).
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk markers to the first SOF (holds height then width).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (SOF.has(marker)) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) break;
      off += 2 + len;
    }
  }
  return null;
}

async function main() {
  const markedOnly = process.argv.includes("--marked-only");
  const rows = await prisma.speciesImage.findMany({
    where: {
      OR: [{ width: null }, { height: null }],
      ...(markedOnly ? { diagnosticMarks: { some: {} } } : {}),
    },
    select: { id: true, scientificName: true, url: true },
  });
  console.log(`Rows missing dimensions: ${rows.length}\n`);

  let fixed = 0, failed = 0;
  for (const r of rows) {
    try {
      const res = await fetch(r.url, {
        headers: { "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const size = imageSize(buf);
      if (!size) throw new Error("unrecognised image header");
      await prisma.speciesImage.update({
        where: { id: r.id },
        data: { width: size.width, height: size.height },
      });
      fixed++;
      console.log(`  ${r.scientificName.padEnd(26)} ${size.width}x${size.height}`);
    } catch (e) {
      failed++;
      console.log(`  ${r.scientificName.padEnd(26)} FAILED: ${(e as Error).message}  ${r.url}`);
    }
  }
  console.log(`\nDone. fixed=${fixed} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
