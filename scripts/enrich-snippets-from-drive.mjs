// Updates Snippet rows with site name, deployment, depth, lat/lon from metadata.json on Drive.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const DRIVE_SNIPS = String.raw`G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips`;

async function main() {
  const folders = fs.readdirSync(DRIVE_SNIPS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let updated = 0;
  for (const folder of folders) {
    const metaPath = path.join(DRIVE_SNIPS, folder, "metadata.json");
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    const snippet = await prisma.snippet.findUnique({ where: { externalId: folder } });
    if (!snippet) continue;

    // Load bbox_data.json if present, store the bboxes array as JSON string
    const bboxPath = path.join(DRIVE_SNIPS, folder, "bbox_data.json");
    let bboxJson = null;
    if (fs.existsSync(bboxPath)) {
      const bboxData = JSON.parse(fs.readFileSync(bboxPath, "utf-8"));
      bboxJson = JSON.stringify(bboxData.bboxes ?? bboxData);
    }

    await prisma.snippet.update({
      where: { id: snippet.id },
      data: {
        site: meta.site ?? snippet.site,
        deployment: meta.deployment ?? snippet.deployment,
        depthM: meta.depth_m ?? null,
        lat: meta.latitude ?? null,
        lon: meta.longitude ?? null,
        recordingDatetime: meta.recording_datetime ?? snippet.recordingDatetime,
        bboxJson,
      },
    });
    updated++;
  }
  console.log(`Enriched ${updated} snippets from Drive metadata.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
