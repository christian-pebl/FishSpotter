// Quick seed from existing public/media/snippets folders (no metadata.json needed)
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const MEDIA_DIR = path.join(__dirname, "..", "public", "media", "snippets");

async function main() {
  const folders = fs.readdirSync(MEDIA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`Found ${folders.length} snippet folders.`);

  for (const folder of folders) {
    const videoPath = path.join(MEDIA_DIR, folder, "snippet.mp4");
    const thumbPath = path.join(MEDIA_DIR, folder, "thumbnail.jpg");

    if (!fs.existsSync(videoPath) || !fs.existsSync(thumbPath)) {
      console.warn(`Skip ${folder}: missing files`);
      continue;
    }

    // Parse folder name: ALG_SC_11_2024-07-08_12-00-41_track10002_142-438_...
    const parts = folder.split("_");
    const site = parts.slice(0, 3).join("_");       // e.g. ALG_SC_11
    const deployment = parts.slice(0, 2).join("_"); // e.g. ALG_SC
    const dateStr = parts[3] ?? null;               // e.g. 2024-07-08
    const timeStr = parts[4] ?? null;               // e.g. 12-00-41
    const recordingDatetime = dateStr && timeStr
      ? `${dateStr}T${timeStr.replace(/-/g, ":")}` : null;

    await prisma.snippet.upsert({
      where: { externalId: folder },
      create: {
        externalId: folder,
        videoUrl: `/media/snippets/${folder}/snippet.mp4`,
        thumbnailUrl: `/media/snippets/${folder}/thumbnail.jpg`,
        site,
        deployment,
        recordingDatetime,
        staffAnswer: "Unknown",
      },
      update: {
        videoUrl: `/media/snippets/${folder}/snippet.mp4`,
        thumbnailUrl: `/media/snippets/${folder}/thumbnail.jpg`,
        site,
        deployment,
        recordingDatetime,
        staffAnswer: "Unknown",
      },
    });
    console.log(`Seeded: ${folder}`);
  }

  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
