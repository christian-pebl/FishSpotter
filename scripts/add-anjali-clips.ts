// One-off: bring in the two clips Anjali emailed (cuttlefish + seal), 19 Jun 2026.
// Uploads video + thumbnail via the shared storage abstraction and upserts a
// Snippet row for each, following the same convention as scripts/seed.ts.
// Run once: npx tsx --env-file=.env.local scripts/add-anjali-clips.ts

import { readFileSync } from "fs";
import { prisma } from "@/lib/prisma";
import { uploadVideo, uploadThumbnail } from "./lib/storage";

const DIR =
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/c34212b3-f738-4e66-9afd-ccf1a18ff3b6/scratchpad/anjali-clips/out";

const CLIPS = [
  {
    externalId: "ALG_anjali_2025-04-19_cuttlefish",
    video: `${DIR}/cuttlefish_algapelago.mp4`,
    thumb: `${DIR}/cuttlefish_algapelago_thumb.jpg`,
    // Reuses the exact site/deployment/coords already established for
    // Algapelago clips in the DB (see ALG_SC_11_* rows).
    site: "Bideford Bay, North Devon, UK",
    deployment: "Algapelago",
    depthM: 20,
    lat: 51.06052123293902,
    lon: -4.361078755052533,
    recordingDatetime: "2025-04-19T10:00:41",
  },
  {
    externalId: "EXO_3_2023-07-23_seal",
    video: `${DIR}/seal_exo3.mp4`,
    thumb: `${DIR}/seal_exo3_thumb.jpg`,
    // Matches the existing East Pickard Bay / META EXO project rows'
    // site+deployment convention; coords + depth are Christian's for THIS
    // specific clip (slightly different rig position/date than the Oct 2023 rows).
    site: "East Pickard Bay, Pembrokeshire, Wales, UK",
    deployment: "East Pickard Bay",
    depthM: 20,
    lat: 51.6648586,
    lon: -5.0979013,
    recordingDatetime: "2023-07-23",
  },
];

async function main() {
  for (const c of CLIPS) {
    console.log(`\n=== ${c.externalId} ===`);
    const videoBuf = readFileSync(c.video);
    const thumbBuf = readFileSync(c.thumb);

    const videoUrl = await uploadVideo(c.externalId, videoBuf);
    console.log("video ->", videoUrl);
    const thumbnailUrl = await uploadThumbnail(c.externalId, thumbBuf);
    console.log("thumb ->", thumbnailUrl);

    const row = await prisma.snippet.upsert({
      where: { externalId: c.externalId },
      create: {
        externalId: c.externalId,
        videoUrl,
        thumbnailUrl,
        site: c.site,
        deployment: c.deployment,
        depthM: c.depthM,
        lat: c.lat,
        lon: c.lon,
        recordingDatetime: c.recordingDatetime,
        staffAnswer: null,
      },
      update: {
        videoUrl,
        thumbnailUrl,
        site: c.site,
        deployment: c.deployment,
        depthM: c.depthM,
        lat: c.lat,
        lon: c.lon,
        recordingDatetime: c.recordingDatetime,
      },
    });
    console.log("snippet row:", row.id);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
