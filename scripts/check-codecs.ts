/**
 * Reads every Snippet.videoUrl from the database, probes its codec with
 * ffprobe, and fails the process if any clip is not H.264.
 *
 * Chrome cannot play MPEG-4 Part 2 Visual (mp4v / mpeg4); we discovered
 * this the hard way (CLAUDE.md "Video / Codec Notes"). This guard makes
 * it impossible to silently regress.
 *
 * Run: npm run check:codecs
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/lib/prisma";

const run = promisify(exec);

async function codec(url: string): Promise<string> {
  const { stdout } = await run(
    `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${url}"`,
  );
  return stdout.trim();
}

async function main() {
  const snippets = await prisma.snippet.findMany({
    select: { id: true, externalId: true, videoUrl: true },
  });
  const bad: string[] = [];
  for (const s of snippets) {
    try {
      const c = await codec(s.videoUrl);
      if (c !== "h264") bad.push(`${s.externalId} (${s.id}): ${c}`);
    } catch (err) {
      bad.push(
        `${s.externalId} (${s.id}): ffprobe failed — ${(err as Error).message}`,
      );
    }
  }
  if (bad.length) {
    console.error("Non-H.264 (or unprobeable) clips found:\n" + bad.join("\n"));
    process.exit(1);
  }
  console.log(`All ${snippets.length} clips are H.264.`);
}

main().finally(() => prisma.$disconnect());
