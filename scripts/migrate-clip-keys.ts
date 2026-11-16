/**
 * Move every live clip onto a storage name that says nothing about it.
 *
 * Before: <bucket>/<export folder name>/snippet.mp4, and for 56 of 139 live
 * clips the folder name carries a species label. After: <bucket>/clips/<hash>.mp4,
 * clips/<hash>-sd.mp4 and thumbs/<hash>.jpg, named after their own bytes (see
 * scripts/lib/object-keys.ts). The logic and its guarantees are in
 * scripts/lib/clip-migration.ts; this file is the command line around it.
 *
 * IT IS A DRY RUN UNLESS YOU PASS --execute. A dry run reads the database and
 * asks storage for one byte of each object. It uploads nothing and changes no
 * row, and that does not rest on the logic being right:
 *   - it never builds a storage client, so it needs no storage key and works
 *     with SUPABASE_SERVICE_ROLE_KEY absent from the environment;
 *   - it reads the rows inside a READ ONLY database transaction;
 *   - the write functions it hands the migration are ones that throw.
 *
 * The same command does both stages of the plan, because "done" means "a
 * content-addressed key on the ACTIVE provider":
 *   stage 1  STORAGE_PROVIDER unset (Supabase): rename inside the same bucket.
 *            Same host, so the CSP and the image whitelist are untouched.
 *   stage 2  STORAGE_PROVIDER=r2, later: copy the same keys to R2.
 *
 * The order to run it in:
 *   npm run db:migrate-clip-keys                          dry run, every row
 *   npm run db:migrate-clip-keys -- --limit 3 --hash      dry run, exact names for 3
 *   npm run db:migrate-clip-keys -- --execute --limit 3   three clips for real
 *   npm run db:migrate-clip-keys -- --execute --all       the rest
 *   npm run db:migrate-clip-keys -- --rollback            dry run of the undo
 *   npm run db:migrate-clip-keys -- --rollback --execute  the undo (database only)
 *   npm run db:migrate-clip-keys -- --delete-old          dry run of the clean-up
 *   npm run db:migrate-clip-keys -- --delete-old --execute   14 days later
 *
 * Flags:
 *   --execute           Actually write. Needs --limit, --external, --id or --all.
 *   --all               Every row (only meaningful with --execute).
 *   --limit N           At most N rows that need work.
 *   --external <id>     One clip, by export folder name.
 *   --id <id>           One clip, by row id.
 *   --hash              In a dry run, read the bytes so the report shows the
 *                       exact new names (costs a download unless cached).
 *   --from <dir>        Local folder of <export folder name>/snippet.mp4 and
 *                       thumbnail.jpg. Used only when a file's checksum equals
 *                       the live object's, otherwise the object is downloaded.
 *   --cache-dir <dir>   Where downloaded objects are kept between runs.
 *   --log <file>        The row-by-row log. Default ~/.fishspotter/clip-keys.jsonl.
 *                       KEEP IT: it is what rollback and clean-up read. It holds
 *                       export folder names, so it must stay out of the repo.
 *   --report <file>     Where to write the JSON report (a .md goes beside it).
 *   --rollback          Put rows back to their logged old URLs.
 *   --delete-old        Delete the old named objects of migrated rows.
 *   --min-age-days N    With --delete-old: only rows migrated N+ days ago (14).
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  CLIP_FIELDS,
  migrateRow,
  parseLog,
  planDeleteOld,
  planRollback,
  type ClipField,
  type ClipRow,
  type FetchedBytes,
  type LogEntry,
  type MigrationDeps,
  type Probe,
  type RowReport,
} from "./lib/clip-migration";
import { checkEtag } from "./lib/etag";
import {
  getActiveProvider,
  getStorageDriver,
  getStorageDriverFor,
  publicBaseFor,
  publicUrlUnder,
  type StorageProvider,
} from "./lib/storage";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(`--${flag}`);
function value(flag: string): string | undefined {
  const i = args.indexOf(`--${flag}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const EXECUTE = has("execute");
const ALL = has("all");
const HASH = has("hash");
const ROLLBACK = has("rollback");
const DELETE_OLD = has("delete-old");
const LIMIT = value("limit") ? parseInt(value("limit")!, 10) : Infinity;
const ONLY_EXTERNAL = value("external");
const ONLY_ID = value("id");
const FROM = value("from");
const MIN_AGE_DAYS = value("min-age-days") ? Number(value("min-age-days")) : 14;

const HOME = path.join(os.homedir(), ".fishspotter");
const LOG_PATH = path.resolve(value("log") ?? path.join(HOME, "clip-keys.jsonl"));
const CACHE_DIR = path.resolve(value("cache-dir") ?? path.join(os.tmpdir(), "fishspotter-clip-cache"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const MODE = ROLLBACK ? "rollback" : DELETE_OLD ? "delete-old" : "migrate";
const REPORT_PATH = path.resolve(
  value("report") ?? path.join(HOME, `clip-keys-${MODE}-${EXECUTE ? "run" : "dry-run"}-${stamp}.json`),
);

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const mb = (bytes: number) => (bytes / 1048576).toFixed(1);

/** Refuses to keep the log or a report where git could pick it up. */
function assertOutsideRepo(file: string, what: string) {
  const repo = path.resolve(__dirname, "..");
  const rel = path.relative(repo, file);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    throw new Error(
      `${what} would be written inside the repository (${file}). It holds export folder names ` +
        "and this repository is public. Choose a path outside it.",
    );
  }
}

/** One byte of a URL. A ranged GET, never a HEAD: a HEAD to Supabase storage
 *  answers with different headers from a real request (measured 12 Nov 2026). */
async function probe(url: string): Promise<Probe> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const total = /\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "");
    const declared = res.headers.get("content-length");
    await res.arrayBuffer();
    const length = total ? Number(total[1]) : res.status === 200 && declared ? Number(declared) : null;
    return {
      ok: res.status === 206 || res.status === 200,
      status: res.status,
      length,
      etag: (res.headers.get("etag") ?? "").replace(/"/g, "") || null,
    };
  } catch {
    return { ok: false, status: 0, length: null, etag: null };
  }
}

const MIRROR_FILES: Partial<Record<ClipField, string[]>> = {
  videoUrl: ["snippet_h264.mp4", "snippet.mp4"],
  thumbnailUrl: ["thumbnail.jpg"],
};

/**
 * The bytes of a live object, from the cheapest place that provably holds
 * them: the download cache, then the local mirror, then the network. Local
 * bytes are used only when their checksum equals the live object's ETag, so a
 * stale mirror can never name an object after the wrong content.
 */
async function fetchBytes(
  url: string,
  live: Probe,
  hint: { externalId: string; field: ClipField },
): Promise<FetchedBytes> {
  const cacheFile = path.join(
    CACHE_DIR,
    `${createHash("sha1").update(url.split("?")[0]).digest("hex")}-${live.etag ?? live.length}.bin`,
  );
  if (fs.existsSync(cacheFile)) {
    const body = fs.readFileSync(cacheFile);
    if (body.length === live.length) return { body, source: "cache" };
  }

  if (FROM) {
    for (const name of MIRROR_FILES[hint.field] ?? []) {
      const local = path.join(FROM, hint.externalId, name);
      if (!fs.existsSync(local) || fs.statSync(local).size !== live.length) continue;
      const body = fs.readFileSync(local);
      const verdict = checkEtag(body, live.etag);
      if (verdict === "md5" || verdict === "multipart") return { body, source: `mirror (${verdict})` };
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`download answered ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const verdict = checkEtag(body, live.etag);
  // A plain MD5 that does not match is a corrupt or changed download. A
  // multipart ETag that matches no usual part size cannot be checked either
  // way, so the length check in migrateRow is what stands behind it.
  if (verdict === "no-match" && !/-\d+$/.test(live.etag ?? "")) {
    throw new Error(`download checksum does not match the live ETag ${live.etag}`);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, body);
  return { body, source: verdict === "no-match" || verdict === "no-etag" ? "download (length only)" : `download (${verdict})` };
}

function appendLog(entry: LogEntry) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const fd = fs.openSync(LOG_PATH, "a");
  try {
    fs.writeSync(fd, JSON.stringify(entry) + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function refuse(what: string): never {
  throw new Error(`dry run: refusing to ${what}. Pass --execute to write.`);
}

async function loadRows(): Promise<ClipRow[]> {
  // READ ONLY: Postgres itself refuses a write inside this transaction.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return tx.snippet.findMany({
      where: ONLY_ID ? { id: ONLY_ID } : ONLY_EXTERNAL ? { externalId: ONLY_EXTERNAL } : undefined,
      select: { id: true, externalId: true, videoUrl: true, videoUrlSd: true, thumbnailUrl: true },
      orderBy: { createdAt: "asc" },
    });
  });
}

function readLog(): LogEntry[] {
  return fs.existsSync(LOG_PATH) ? parseLog(fs.readFileSync(LOG_PATH, "utf8")) : [];
}

function writeReport(json: unknown, markdown: string) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(json, null, 2));
  const mdPath = REPORT_PATH.replace(/\.json$/, "") + ".md";
  fs.writeFileSync(mdPath, markdown);
  console.log(`\nReport: ${REPORT_PATH}\n        ${mdPath}`);
}

function banner(driver: { provider: string; publicBase: string }) {
  const db = (() => {
    try {
      return new URL(process.env.POSTGRES_PRISMA_URL ?? "").hostname;
    } catch {
      return "(unparseable)";
    }
  })();
  console.log(`Mode: ${MODE}   ${EXECUTE ? "EXECUTE (writes)" : "DRY RUN (writes nothing)"}`);
  console.log(`Target: ${driver.provider}  ${driver.publicBase}`);
  console.log(`Database host: ${db}`);
  console.log(`Log: ${LOG_PATH}`);
}

/* ------------------------------ migrate ---------------------------------- */

async function runMigrate() {
  // A dry run gets the public address only. No client, no key.
  const provider = getActiveProvider();
  const driver = EXECUTE ? getStorageDriver() : null;
  const target = { provider, publicBase: driver?.publicBase ?? publicBaseFor(provider) };
  banner(target);
  if (EXECUTE && !(ALL || Number.isFinite(LIMIT) || ONLY_EXTERNAL || ONLY_ID)) {
    throw new Error("--execute needs a scope: --limit N, --external <id>, --id <id> or --all.");
  }
  if (FROM && !fs.existsSync(FROM)) throw new Error(`--from folder not found: ${FROM}`);

  const deps: MigrationDeps = {
    target: driver ?? {
      ...target,
      publicUrlForKey: (key) => publicUrlUnder(target.publicBase, key),
      uploadObject: async () => refuse("upload an object"),
    },
    probe,
    fetchBytes,
    updateRow: EXECUTE
      ? async (id, data) => {
          await prisma.snippet.update({ where: { id }, data });
        }
      : async () => refuse("update a row"),
    appendLog: EXECUTE ? appendLog : () => refuse("write the log"),
    now: () => new Date(),
    sleep,
  };

  const rows = await loadRows();
  console.log(`Rows: ${rows.length}\n`);

  const reports: RowReport[] = [];
  let worked = 0;
  for (const row of rows) {
    if (worked >= LIMIT) break;
    const report = await migrateRow(row, deps, { execute: EXECUTE, hash: HASH });
    reports.push(report);
    if (report.status === "already") continue;
    worked++;
    const size = report.fields.reduce((s, f) => s + f.bytes, 0);
    const line = report.fields
      .map((f) => `${f.field.replace("Url", "")}=${f.newKey ?? "(hash of its bytes)"}`)
      .join("  ");
    if (report.status === "failed") console.log(`FAIL ${row.externalId}: ${report.error}`);
    else console.log(`${report.status === "migrated" ? "OK  " : "PLAN"} ${row.externalId}  ${mb(size)} MB  ${line}`);
  }

  const counted = reports.filter((r) => r.status !== "already");
  const fields = counted.flatMap((r) => r.fields);
  const bytesBy = (f: ClipField) => fields.filter((x) => x.field === f).reduce((s, x) => s + x.bytes, 0);
  const total = fields.reduce((s, f) => s + f.bytes, 0);
  const summary = {
    mode: MODE,
    executed: EXECUTE,
    at: new Date().toISOString(),
    provider: target.provider,
    publicBase: target.publicBase,
    rowsInDatabase: rows.length,
    rowsAlreadyOnContentKeys: reports.filter((r) => r.status === "already").length,
    rowsConsidered: counted.length,
    rowsMigrated: counted.filter((r) => r.status === "migrated").length,
    rowsPlanned: counted.filter((r) => r.status === "planned").length,
    rowsFailed: counted.filter((r) => r.status === "failed").length,
    rowsNotReached: rows.length - reports.length,
    objects: fields.length,
    objectsByField: Object.fromEntries(CLIP_FIELDS.map((f) => [f, fields.filter((x) => x.field === f).length])),
    megabytes: {
      videoUrl: Number(mb(bytesBy("videoUrl"))),
      videoUrlSd: Number(mb(bytesBy("videoUrlSd"))),
      thumbnailUrl: Number(mb(bytesBy("thumbnailUrl"))),
      total: Number(mb(total)),
    },
    rowsWithoutSdRendition: counted.filter((r) => !r.fields.some((f) => f.field === "videoUrlSd")).length,
    // The label test is a pattern, not a species list: a run of letters where a
    // clip number normally sits, just before "_track_manual".
    folderNamesCarryingALabel: counted.filter((r) => /_[A-Za-z]{3,}\d*_track_manual/.test(r.externalId)).length,
    sources: fields.reduce<Record<string, number>>((acc, f) => {
      const key = f.source ?? "not read (dry run)";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const md = [
    `# Clip key migration: ${EXECUTE ? "run" : "dry run"} (${summary.at.slice(0, 16).replace("T", " ")} UTC)`,
    "",
    EXECUTE ? "This run wrote to storage and to the database." : "Nothing was uploaded and no row was changed.",
    "",
    `- Target: ${summary.provider}, ${summary.publicBase}`,
    `- Rows in the database: ${summary.rowsInDatabase}`,
    `- Already on content-addressed keys: ${summary.rowsAlreadyOnContentKeys}`,
    `- Rows ${EXECUTE ? "migrated" : "that would be migrated"}: ${EXECUTE ? summary.rowsMigrated : summary.rowsPlanned}`,
    `- Rows that failed: ${summary.rowsFailed}`,
    `- Rows not reached (limit): ${summary.rowsNotReached}`,
    `- Objects: ${summary.objects} (${summary.objectsByField.videoUrl} masters, ${summary.objectsByField.videoUrlSd} 720p renditions, ${summary.objectsByField.thumbnailUrl} stills)`,
    `- Size: ${summary.megabytes.total} MB (masters ${summary.megabytes.videoUrl}, renditions ${summary.megabytes.videoUrlSd}, stills ${summary.megabytes.thumbnailUrl})`,
    `- Rows with no 720p rendition: ${summary.rowsWithoutSdRendition}`,
    `- Folder names carrying a label: ${summary.folderNamesCarryingALabel}`,
    "",
    "While the old objects are kept, storage holds both copies: the size above, twice.",
    "",
    "| Clip (row id) | Status | Master | 720p | Still | MB |",
    "|---|---|---|---|---|---|",
    ...counted.map((r) => {
      const cell = (f: ClipField) => {
        const x = r.fields.find((y) => y.field === f);
        return x ? (x.newKey ?? "hash of its bytes") : "none";
      };
      return `| ${r.id} | ${r.status}${r.error ? ": " + r.error.replace(/\|/g, "/").slice(0, 120) : ""} | ${cell("videoUrl")} | ${cell("videoUrlSd")} | ${cell("thumbnailUrl")} | ${mb(r.fields.reduce((s, f) => s + f.bytes, 0))} |`;
    }),
    "",
  ].join("\n");

  console.log(`\n${JSON.stringify(summary, null, 2)}`);
  writeReport({ summary, rows: counted }, md);
  if (!EXECUTE) console.log("\nDRY RUN: nothing was uploaded and no row was changed.");
  if (summary.rowsFailed > 0) process.exitCode = 1;
}

/* ------------------------------ rollback --------------------------------- */

async function runRollback() {
  const provider = getActiveProvider();
  banner({ provider, publicBase: publicBaseFor(provider) });
  const entries = readLog();
  if (entries.length === 0) throw new Error(`No log entries at ${LOG_PATH}. Nothing to roll back.`);
  const steps = planRollback(entries, await loadRows());
  let restored = 0;
  for (const step of steps) {
    const fields = Object.keys(step.restore) as ClipField[];
    for (const s of step.skipped) console.log(`SKIP ${step.externalId} ${s.field}: ${s.reason}`);
    if (fields.length === 0) continue;
    if (EXECUTE) {
      await prisma.snippet.update({ where: { id: step.id }, data: step.restore });
      appendLog({ v: 1, type: "rolled-back", at: new Date().toISOString(), id: step.id, fields });
    }
    restored++;
    console.log(`${EXECUTE ? "BACK" : "PLAN"} ${step.externalId}: ${fields.join(", ")}`);
  }
  console.log(`\n${EXECUTE ? "Rolled back" : "Would roll back"} ${restored} row(s). Storage is not touched by a rollback.`);
  writeReport({ mode: MODE, executed: EXECUTE, steps }, `# Clip key rollback: ${EXECUTE ? "run" : "dry run"}\n\n${restored} row(s).\n`);
  if (!EXECUTE) console.log("DRY RUN: no row was changed.");
}

/* ----------------------------- delete old -------------------------------- */

function configuredBases(): Partial<Record<StorageProvider, string>> {
  const bases: Partial<Record<StorageProvider, string>> = {};
  for (const provider of ["supabase", "r2"] as const) {
    try {
      bases[provider] = publicBaseFor(provider);
    } catch {
      // That provider is not configured in this environment.
    }
  }
  return bases;
}

async function runDeleteOld() {
  const provider = getActiveProvider();
  banner({ provider, publicBase: publicBaseFor(provider) });
  const entries = readLog();
  if (entries.length === 0) throw new Error(`No log entries at ${LOG_PATH}. Nothing to delete.`);
  const plan = planDeleteOld(entries, await loadRows(), {
    now: new Date(),
    minAgeDays: MIN_AGE_DAYS,
    bases: configuredBases(),
  });
  for (const h of plan.held) console.log(`HOLD ${h.externalId}: ${h.reason}`);

  let deleted = 0;
  for (const step of plan.steps) {
    // The new copies must still be there, checked at the moment of deletion.
    let healthy = true;
    for (const need of step.mustAnswer) {
      const p = await probe(need.url);
      if (!p.ok || p.length !== need.bytes) {
        healthy = false;
        console.log(`HOLD ${step.externalId}: a migrated URL no longer answers correctly, old objects kept`);
        break;
      }
    }
    if (!healthy) continue;
    if (EXECUTE) {
      await getStorageDriverFor(step.provider as StorageProvider).removeObjects(step.keys);
      appendLog({
        v: 1,
        type: "deleted-old",
        at: new Date().toISOString(),
        id: step.id,
        provider: step.provider,
        keys: step.keys,
      });
    }
    deleted += step.keys.length;
    console.log(`${EXECUTE ? "DEL " : "PLAN"} ${step.externalId}: ${step.keys.length} object(s) on ${step.provider}`);
  }
  console.log(
    `\n${EXECUTE ? "Deleted" : "Would delete"} ${deleted} old object(s); ${plan.held.length} row(s) held. ` +
      "After this, rollback is no longer possible for those rows.",
  );
  writeReport({ mode: MODE, executed: EXECUTE, plan }, `# Clip key clean-up: ${EXECUTE ? "run" : "dry run"}\n\n${deleted} object(s), ${plan.held.length} row(s) held.\n`);
  if (!EXECUTE) console.log("DRY RUN: nothing was deleted.");
}

async function main() {
  assertOutsideRepo(LOG_PATH, "The log");
  assertOutsideRepo(REPORT_PATH, "The report");
  if (ROLLBACK && DELETE_OLD) throw new Error("Choose one of --rollback and --delete-old.");
  // Named so a slip of the env file is visible before anything happens.
  getActiveProvider();
  if (ROLLBACK) await runRollback();
  else if (DELETE_OLD) await runDeleteOld();
  else await runMigrate();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
