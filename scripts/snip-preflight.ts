/**
 * Snip preflight (npm run snips:check).
 *
 * Answers two questions about the exported-snips folder, without writing
 * anything: which snips are not yet on FishSpotter, and which of those carry
 * every field the app needs versus which would land half-blank.
 *
 * It exists because the 25 Aug 2026 NORF-1 batch synced with site, deployment,
 * depth, lat, lon and recording_datetime all empty. TRDesk4's metadata.json had
 * no deployment record at all, and the `?? "Unknown"` / `?? null` fallbacks in
 * sync.ts wrote the blanks without complaint. Blank geo silently costs the
 * farm-page join (Snippet.deployment is the key), the OBIS probability bucket,
 * and therefore the Pebbles rarity multiplier, which consensus freezes
 * permanently on first credit. Catching it before upload is far cheaper than
 * backfilling afterwards.
 *
 * It also checks the PIXELS. On 25 Aug 2026 the same batch shipped with the ML
 * detector's HUD and bounding boxes burned into the frames, because TRDesk4 fell
 * back to cutting from `*_unified_tracked.mp4` when it could not find the raw
 * footage. Metadata completeness cannot catch that (those clips were H.264, the
 * right length, and looked structurally fine); only looking at the image can.
 * See `scripts/lib/burn-in.ts`.
 *
 * Verdicts, per folder:
 *   READY   new or changed, metadata complete, no burnt-in overlay. Safe to sync.
 *   HOLD    new or changed, but a required field is missing, or the clip has a
 *           detector overlay burned into it. Names the reason.
 *   SKIP    excluded (TRDesk4 toggle or blocklist), or not a complete snip folder.
 *   SYNCED  already on FishSpotter and unchanged since the last sync.
 *
 * Read-only: it never uploads, and never touches the DB or the manifest.
 *
 * Run:
 *   npm run snips:check
 *   npm run snips:check -- --json             machine-readable dump
 *   npm run snips:check -- --report <path>    also write the JSON to a file
 */
import * as fs from "fs";
import * as path from "path";
import { isSnippetExcluded } from "../src/lib/snippet-blocklist";
import { checkSnipBurnIn, type BurnInStatus } from "./lib/burn-in";

const SNIPS_DIR = process.env.SNIPS_DIR ?? path.join(process.cwd(), "Fish Spotter Snips");
const MANIFEST_PATH = path.join(process.cwd(), ".sync-manifest.json");

const JSON_OUT = process.argv.includes("--json");
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/**
 * Every metadata field the app actually reads off a snip. Keep this in step
 * with the `data` object in sync.ts: if sync starts persisting a new metadata
 * field, gate it here too, or the next batch repeats the NORF-1 failure for
 * that column.
 */
const REQUIRED_META = [
  "site",
  "deployment",
  "depth_m",
  "latitude",
  "longitude",
  "recording_datetime",
] as const;

type Verdict = "READY" | "HOLD" | "SKIP" | "SYNCED";

interface Result {
  folder: string;
  verdict: Verdict;
  reason: string;
  missing: string[];
  isNew: boolean;
  site?: string;
  deployment?: string;
  /** Result of the pixel check; absent when the snip never got that far. */
  burnIn?: BurnInStatus;
}

interface Signature {
  video: string;
  bbox: string;
  meta: string;
}

function statSig(p: string | null): string {
  if (!p) return "";
  try {
    const s = fs.statSync(p);
    return `${s.size}:${Math.round(s.mtimeMs)}`;
  } catch {
    return "";
  }
}

function getVideoPath(dir: string): string | null {
  const h264 = path.join(dir, "snippet_h264.mp4");
  const plain = path.join(dir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

function folderSignature(dir: string): Signature {
  return {
    video: statSig(getVideoPath(dir)),
    bbox: statSig(path.join(dir, "bbox_data.json")),
    meta: statSig(path.join(dir, "metadata.json")),
  };
}

function inspect(folder: string, manifest: Record<string, Signature>): Result {
  const base: Result = { folder, verdict: "SKIP", reason: "", missing: [], isNew: true };
  const dir = path.join(SNIPS_DIR, folder);

  if (isSnippetExcluded(folder)) return { ...base, reason: "in snippet-blocklist" };

  const metaPath = path.join(dir, "metadata.json");
  const videoPath = getVideoPath(dir);
  const thumbPath = path.join(dir, "thumbnail.jpg");
  if (!fs.existsSync(metaPath)) return { ...base, reason: "no metadata.json" };
  if (!videoPath) return { ...base, reason: "no snippet.mp4" };
  if (!fs.existsSync(thumbPath)) return { ...base, reason: "no thumbnail.jpg" };

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, reason: `unreadable metadata.json: ${msg}` };
  }

  if (meta.fishspotter_excluded === true) {
    return { ...base, reason: "fishspotter_excluded in TRDesk4" };
  }

  const prev = manifest[folder];
  const sig = folderSignature(dir);
  const isNew = !prev;
  const changed =
    !prev || prev.video !== sig.video || prev.bbox !== sig.bbox || prev.meta !== sig.meta;

  const site = typeof meta.site === "string" ? meta.site : undefined;
  const deployment = typeof meta.deployment === "string" ? meta.deployment : undefined;

  if (!changed) {
    return {
      ...base,
      verdict: "SYNCED",
      reason: "unchanged since last sync",
      isNew: false,
      site,
      deployment,
    };
  }

  // Treat null, undefined and "" alike. sync.ts uses `??`, which lets an empty
  // string through as though it were a real value, so an empty site would be
  // persisted verbatim rather than falling back.
  const missing = REQUIRED_META.filter((k) => {
    const v = meta[k];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });

  if (missing.length > 0) {
    return {
      ...base,
      verdict: "HOLD",
      reason: `metadata.json missing: ${missing.join(", ")}`,
      missing: [...missing],
      isNew,
      site,
      deployment,
    };
  }

  // Pixel gate. Only reached for a snip that is otherwise ready, so the ffmpeg
  // cost is paid once per new/changed clip rather than on every scan.
  const burnIn = checkSnipBurnIn(videoPath, meta);
  if (burnIn.status === "burned-in") {
    return {
      ...base,
      verdict: "HOLD",
      reason: `detector overlay burned into the clip: ${burnIn.reason}`,
      isNew,
      site,
      deployment,
      burnIn: burnIn.status,
    };
  }

  return {
    ...base,
    verdict: "READY",
    reason: isNew ? "new snip, metadata complete" : "changed snip, metadata complete",
    isNew,
    site,
    deployment,
    burnIn: burnIn.status,
  };
}

function main() {
  if (!fs.existsSync(SNIPS_DIR)) {
    console.error(`SNIPS_DIR not found: ${SNIPS_DIR}`);
    process.exit(2);
  }

  let manifest: Record<string, Signature> = {};
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, Signature>;
  } catch {
    // First run: no manifest yet, so everything reads as new.
  }

  const folders = fs
    .readdirSync(SNIPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const results = folders.map((f) => inspect(f, manifest));
  const by = (v: Verdict) => results.filter((r) => r.verdict === v);
  const ready = by("READY");
  const hold = by("HOLD");
  const skip = by("SKIP");
  const synced = by("SYNCED");

  const payload = {
    snipsDir: SNIPS_DIR,
    scannedAt: new Date().toISOString(),
    totals: {
      scanned: results.length,
      ready: ready.length,
      hold: hold.length,
      skip: skip.length,
      synced: synced.length,
    },
    ready: ready.map((r) => ({
      folder: r.folder,
      deployment: r.deployment,
      isNew: r.isNew,
      burnIn: r.burnIn,
    })),
    hold: hold.map((r) => ({
      folder: r.folder,
      missing: r.missing,
      reason: r.reason,
      deployment: r.deployment,
      isNew: r.isNew,
      burnIn: r.burnIn,
    })),
    skip: skip.map((r) => ({ folder: r.folder, reason: r.reason })),
  };

  const reportPath = arg("report");
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Snip preflight: ${SNIPS_DIR}`);
  console.log(
    `scanned ${results.length}   READY ${ready.length}   HOLD ${hold.length}   ` +
      `SKIP ${skip.length}   already synced ${synced.length}\n`,
  );

  if (ready.length > 0) {
    console.log(`READY to upload (${ready.length}), metadata complete:`);
    const byDep = new Map<string, number>();
    for (const r of ready) {
      const k = r.deployment ?? "(none)";
      byDep.set(k, (byDep.get(k) ?? 0) + 1);
    }
    for (const [d, n] of byDep) console.log(`   ${String(n).padStart(3)}  ${d}`);
    console.log();
  }

  const burned = hold.filter((r) => r.burnIn === "burned-in");
  const heldForMeta = hold.filter((r) => r.burnIn !== "burned-in");

  if (heldForMeta.length > 0) {
    console.log(`HELD (${heldForMeta.length}), not uploaded until these are filled in TRDesk4:`);
    const byMissing = new Map<string, string[]>();
    for (const r of heldForMeta) {
      const k = r.missing.join(", ");
      byMissing.set(k, [...(byMissing.get(k) ?? []), r.folder]);
    }
    for (const [fields, held] of byMissing) {
      console.log(`   ${held.length} snip(s) missing: ${fields}`);
      for (const f of held.slice(0, 5)) console.log(`      - ${f}`);
      if (held.length > 5) console.log(`      ... and ${held.length - 5} more`);
    }
    console.log();
  }

  if (burned.length > 0) {
    console.log(`HELD (${burned.length}) with a DETECTOR OVERLAY BURNED INTO THE PIXELS:`);
    for (const r of burned) console.log(`   - ${r.folder}\n       ${r.reason}`);
    console.log(
      "\n   These were cut from an ML pipeline render, not the raw footage, so the\n" +
        "   detector's answer is drawn on the animal. Re-export from the original in\n" +
        "   TRDesk4 (check the video resolves via data/clip_registry.json) and re-run.\n",
    );
  }

  const unknown = results.filter((r) => r.burnIn === "unknown");
  if (unknown.length > 0) {
    console.log(
      `WARNING: could not inspect the pixels of ${unknown.length} snip(s) ` +
        "(is ffmpeg/ffprobe on PATH?).\n   The burn-in gate did not run for them.\n",
    );
  }

  if (skip.length > 0) {
    const byReason = new Map<string, number>();
    for (const r of skip) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
    console.log(`SKIPPED (${skip.length}):`);
    for (const [reason, n] of byReason) console.log(`   ${String(n).padStart(3)}  ${reason}`);
    console.log();
  }

  if (hold.length > 0) {
    console.log("Fix the held snips in TRDesk4 (set the deployment record on the source");
    console.log("video, then re-export) and re-run. This command never uploads anything.");
  }
}

main();
