import { beforeEach, describe, expect, it } from "vitest";
import {
  fieldState,
  migrateRow,
  parseLog,
  planDeleteOld,
  planRollback,
  type ClipField,
  type ClipRow,
  type LogEntry,
  type MigrationDeps,
  type Probe,
} from "../clip-migration";
import { legacyObjectKey, objectKey } from "../object-keys";

/**
 * The clip migration, run for real against a pretend world.
 *
 * `World` is storage, the database, the network, the clock and the log in one
 * object, and it records every write in the order it happened. The tests then
 * ask the questions that matter before this is pointed at production: did a
 * dry run write anything, did the row change before its new URLs were checked,
 * was the log written first, and do rollback and clean-up refuse to act on a
 * row that no longer looks the way the migration left it.
 */

const BASE = "https://example.supabase.co/storage/v1/object/public/snippets";
const R2_BASE = "https://media.fishspotter.app";
const FOLDER = "CYM_Farm_S_2026-06-15_08-00_wrasse00007270_track_manual_86-353_20260828_094841";

const MASTER = Buffer.from("master bytes ".repeat(40));
const SD = Buffer.from("sd bytes ".repeat(20));
const STILL = Buffer.from("still bytes ".repeat(5));

const legacyUrl = (kind: Parameters<typeof legacyObjectKey>[1], v: number) =>
  `${BASE}/${legacyObjectKey(FOLDER, kind)}?v=${v}`;

function row(overrides: Partial<ClipRow> = {}): ClipRow {
  return {
    id: "clip1",
    externalId: FOLDER,
    videoUrl: legacyUrl("video", 4),
    videoUrlSd: legacyUrl("video_sd", 1),
    thumbnailUrl: legacyUrl("thumbnail", 3),
    ...overrides,
  };
}

class World {
  /** URL (without query) -> bytes. What storage holds and serves. */
  objects = new Map<string, Buffer>();
  rows = new Map<string, ClipRow>();
  log: LogEntry[] = [];
  /** Every write, in order: "upload <key>", "log <type>", "update <id>". */
  events: string[] = [];
  time = new Date("2026-11-12T12:00:00Z");
  failUploadOf: string | null = null;
  /** New URLs that answer with the wrong length (a truncated upload). */
  truncate = new Set<string>();
  failUpdate = false;

  constructor(
    public base = BASE,
    public provider = "supabase",
  ) {}

  seed(r: ClipRow) {
    this.rows.set(r.id, { ...r });
    this.objects.set(r.videoUrl.split("?")[0], MASTER);
    if (r.videoUrlSd) this.objects.set(r.videoUrlSd.split("?")[0], SD);
    this.objects.set(r.thumbnailUrl.split("?")[0], STILL);
    return this.rows.get(r.id)!;
  }

  deps(): MigrationDeps {
    return {
      target: {
        provider: this.provider,
        publicBase: this.base,
        publicUrlForKey: (key) => `${this.base}/${key}`,
        uploadObject: async (key, body) => {
          if (this.failUploadOf && key.includes(this.failUploadOf)) throw new Error("upload refused");
          this.events.push(`upload ${key}`);
          this.objects.set(`${this.base}/${key}`, body);
          return `${this.base}/${key}`;
        },
      },
      probe: async (url): Promise<Probe> => {
        const clean = url.split("?")[0];
        const body = this.objects.get(clean);
        if (!body) return { ok: false, status: 404, length: null, etag: null };
        const length = this.truncate.has(clean) ? body.length - 1 : body.length;
        return { ok: true, status: 206, length, etag: null };
      },
      fetchBytes: async (url) => {
        const body = this.objects.get(url.split("?")[0]);
        if (!body) throw new Error("download answered 404");
        return { body, source: "download" };
      },
      updateRow: async (id, data) => {
        if (this.failUpdate) throw new Error("database unavailable");
        this.events.push(`update ${id}`);
        Object.assign(this.rows.get(id)!, data);
      },
      appendLog: (entry) => {
        this.events.push(`log ${entry.type}`);
        this.log.push(entry);
      },
      now: () => this.time,
      sleep: async () => {},
    };
  }

  currentRows(): ClipRow[] {
    return [...this.rows.values()].map((r) => ({ ...r }));
  }
}

const EXECUTE = { execute: true, hash: false, verifyAttempts: 2, verifyDelayMs: 0 };
const DRY = { execute: false, hash: false };

let world: World;
beforeEach(() => {
  world = new World();
});

describe("fieldState", () => {
  it("separates named keys, content keys on the target, and a missing rendition", () => {
    const r = row({ videoUrlSd: null, thumbnailUrl: `${BASE}/${objectKey("thumbnail", STILL)}` });
    expect(fieldState(r, "videoUrl", BASE).state).toBe("todo");
    expect(fieldState(r, "videoUrlSd", BASE).state).toBe("absent");
    expect(fieldState(r, "thumbnailUrl", BASE).state).toBe("done");
  });

  it("treats a content key on ANOTHER provider as still to do", () => {
    const r = row({ videoUrl: `${BASE}/${objectKey("video", MASTER)}` });
    expect(fieldState(r, "videoUrl", BASE).state).toBe("done");
    expect(fieldState(r, "videoUrl", R2_BASE).state).toBe("todo");
  });

  it("does not accept a content key of the wrong kind in a field", () => {
    const r = row({ videoUrl: `${BASE}/${objectKey("video_sd", SD)}` });
    expect(fieldState(r, "videoUrl", BASE).state).toBe("todo");
  });
});

describe("a dry run", () => {
  it("writes nothing: no upload, no log line, no row change", async () => {
    const before = world.seed(row());
    const snapshot = { ...before };
    const objectsBefore = world.objects.size;

    const report = await migrateRow(before, world.deps(), DRY);

    expect(report.status).toBe("planned");
    expect(world.events).toEqual([]);
    expect(world.log).toEqual([]);
    expect(world.objects.size).toBe(objectsBefore);
    expect(world.rows.get("clip1")).toEqual(snapshot);
  });

  it("reports sizes from one byte of each object, and no names it has not computed", async () => {
    const report = await migrateRow(world.seed(row()), world.deps(), DRY);
    expect(report.fields.map((f) => [f.field, f.bytes, f.newKey])).toEqual([
      ["videoUrl", MASTER.length, null],
      ["videoUrlSd", SD.length, null],
      ["thumbnailUrl", STILL.length, null],
    ]);
  });

  it("with --hash, names the exact keys and still writes nothing", async () => {
    const report = await migrateRow(world.seed(row()), world.deps(), { execute: false, hash: true });
    expect(report.fields.map((f) => f.newKey)).toEqual([
      objectKey("video", MASTER),
      objectKey("video_sd", SD),
      objectKey("thumbnail", STILL),
    ]);
    expect(world.events).toEqual([]);
  });
});

describe("a real run", () => {
  it("uploads, checks, logs, then changes the row, in that order", async () => {
    const report = await migrateRow(world.seed(row()), world.deps(), EXECUTE);

    expect(report.status).toBe("migrated");
    expect(world.events).toEqual([
      `upload ${objectKey("video", MASTER)}`,
      `upload ${objectKey("video_sd", SD)}`,
      `upload ${objectKey("thumbnail", STILL)}`,
      "log row",
      "update clip1",
      "log applied",
    ]);
    expect(world.rows.get("clip1")).toMatchObject({
      videoUrl: `${BASE}/${objectKey("video", MASTER)}`,
      videoUrlSd: `${BASE}/${objectKey("video_sd", SD)}`,
      thumbnailUrl: `${BASE}/${objectKey("thumbnail", STILL)}`,
    });
  });

  it("leaves nothing of the folder name in the new URLs", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const r = world.rows.get("clip1")!;
    for (const url of [r.videoUrl, r.videoUrlSd!, r.thumbnailUrl]) {
      // ("snippets" alone is the bucket name, which every URL carries.)
      expect(url).not.toMatch(/wrasse|CYM|track_manual|snippet\.mp4|snippet_720|thumbnail\.jpg|\?v=/);
    }
  });

  it("keeps the old objects exactly where they were", async () => {
    const seeded = world.seed(row());
    const oldUrls = [seeded.videoUrl, seeded.videoUrlSd!, seeded.thumbnailUrl].map((u) => u.split("?")[0]);
    await migrateRow(seeded, world.deps(), EXECUTE);
    for (const url of oldUrls) expect(world.objects.has(url)).toBe(true);
  });

  it("records the old and new URL of every field before the row changes", async () => {
    const seeded = world.seed(row());
    const old = { ...seeded };
    await migrateRow(seeded, world.deps(), EXECUTE);
    const entry = world.log[0];
    expect(entry.type).toBe("row");
    if (entry.type !== "row") throw new Error("unreachable");
    expect(entry.fields.videoUrl).toEqual({
      old: old.videoUrl,
      new: `${BASE}/${objectKey("video", MASTER)}`,
      bytes: MASTER.length,
    });
    expect(Object.keys(entry.fields).sort()).toEqual(["thumbnailUrl", "videoUrl", "videoUrlSd"]);
  });

  it("does not change the row when a new URL answers with the wrong length", async () => {
    const seeded = world.seed(row());
    const snapshot = { ...seeded };
    world.truncate.add(`${BASE}/${objectKey("video_sd", SD)}`);

    const report = await migrateRow(seeded, world.deps(), EXECUTE);

    expect(report.status).toBe("failed");
    expect(report.error).toContain("failed its check");
    expect(world.rows.get("clip1")).toEqual(snapshot);
    expect(world.events.filter((e) => e.startsWith("update") || e.startsWith("log"))).toEqual([]);
  });

  it("does not change the row when an upload fails part way", async () => {
    const seeded = world.seed(row());
    const snapshot = { ...seeded };
    world.failUploadOf = "thumbs/";

    const report = await migrateRow(seeded, world.deps(), EXECUTE);

    expect(report.status).toBe("failed");
    expect(world.rows.get("clip1")).toEqual(snapshot);
    expect(world.log).toEqual([]);
  });

  it("fails, and changes nothing, when a current object does not answer", async () => {
    const seeded = world.seed(row());
    world.objects.delete(seeded.thumbnailUrl.split("?")[0]);
    const report = await migrateRow(seeded, world.deps(), EXECUTE);
    expect(report.status).toBe("failed");
    expect(world.events).toEqual([]);
  });

  it("skips a row that is already done, and finishes one that is half done", async () => {
    const seeded = world.seed(row());
    await migrateRow(seeded, world.deps(), EXECUTE);
    world.events = [];

    const again = await migrateRow(world.rows.get("clip1")!, world.deps(), EXECUTE);
    expect(again.status).toBe("already");
    expect(world.events).toEqual([]);

    // A re-cut master synced in under a named key since: only that field moves.
    const half = world.rows.get("clip1")!;
    half.videoUrl = legacyUrl("video", 5);
    const next = await migrateRow(half, world.deps(), EXECUTE);
    expect(next.status).toBe("migrated");
    expect(next.fields.map((f) => f.field)).toEqual(["videoUrl"]);
  });

  it("moves a row with no 720p rendition without inventing one", async () => {
    const seeded = world.seed(row({ videoUrlSd: null }));
    const report = await migrateRow(seeded, world.deps(), EXECUTE);
    expect(report.fields.map((f) => f.field)).toEqual(["videoUrl", "thumbnailUrl"]);
    expect(world.rows.get("clip1")!.videoUrlSd).toBeNull();
  });

  it("stage 2: copies the same keys to another provider", async () => {
    const seeded = world.seed(row());
    await migrateRow(seeded, world.deps(), EXECUTE);
    const afterStage1 = { ...world.rows.get("clip1")! };

    const r2 = new World(R2_BASE, "r2");
    r2.objects = world.objects;
    r2.rows = world.rows;
    const report = await migrateRow(world.rows.get("clip1")!, r2.deps(), EXECUTE);

    expect(report.status).toBe("migrated");
    expect(world.rows.get("clip1")!.videoUrl).toBe(`${R2_BASE}/${objectKey("video", MASTER)}`);
    // Same key, different host: the path after the base is unchanged.
    expect(world.rows.get("clip1")!.videoUrl.slice(R2_BASE.length)).toBe(afterStage1.videoUrl.slice(BASE.length));
  });
});

describe("rollback", () => {
  it("is a database update back to the logged URLs", async () => {
    const seeded = world.seed(row());
    const old = { ...seeded };
    await migrateRow(seeded, world.deps(), EXECUTE);

    const [step] = planRollback(world.log, world.currentRows());

    expect(step.restore).toEqual({
      videoUrl: old.videoUrl,
      videoUrlSd: old.videoUrlSd,
      thumbnailUrl: old.thumbnailUrl,
    });
    expect(step.skipped).toEqual([]);
  });

  it("leaves a field alone if something changed it after the migration", async () => {
    const seeded = world.seed(row());
    await migrateRow(seeded, world.deps(), EXECUTE);
    world.rows.get("clip1")!.videoUrl = `${BASE}/clips/aaaaaaaaaaaaaaaaaaaaaaaa.mp4`;

    const [step] = planRollback(world.log, world.currentRows());

    expect(Object.keys(step.restore).sort()).toEqual(["thumbnailUrl", "videoUrlSd"]);
    expect(step.skipped).toEqual([{ field: "videoUrl", reason: "changed since the migration" }]);
  });

  it("has nothing to restore when the row never changed (the update failed)", async () => {
    const seeded = world.seed(row());
    world.failUpdate = true;
    const report = await migrateRow(seeded, world.deps(), EXECUTE);
    expect(report.status).toBe("failed");
    // The write-ahead line exists, the row is untouched.
    expect(world.log.map((e) => e.type)).toEqual(["row"]);

    const [step] = planRollback(world.log, world.currentRows());
    expect(step.restore).toEqual({});
    expect(step.skipped.every((s) => s.reason === "already holds the old URL")).toBe(true);
  });

  it("is not offered twice, nor after the old objects are gone", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const rolledBack: LogEntry = { v: 1, type: "rolled-back", at: "2026-11-13T00:00:00Z", id: "clip1", fields: ["videoUrl"] };
    expect(planRollback([...world.log, rolledBack], world.currentRows())[0].restore).toEqual({});

    const deleted: LogEntry = { v: 1, type: "deleted-old", at: "2026-11-27T00:00:00Z", id: "clip1", provider: "supabase", keys: [] };
    const [step] = planRollback([...world.log, deleted], world.currentRows());
    expect(step.restore).toEqual({});
    expect(step.skipped[0].reason).toBe("its old objects were deleted");
  });
});

describe("deleting the old objects", () => {
  const bases = { supabase: BASE };
  const days = (n: number) => new Date(new Date("2026-11-12T12:00:00Z").getTime() + n * 86400000);

  it("holds everything younger than the minimum age", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const plan = planDeleteOld(world.log, world.currentRows(), { now: days(13), minAgeDays: 14, bases });
    expect(plan.steps).toEqual([]);
    expect(plan.held[0].reason).toContain("under the 14-day minimum");
  });

  it("offers exactly the three named keys once the row is old enough", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const plan = planDeleteOld(world.log, world.currentRows(), { now: days(14), minAgeDays: 14, bases });
    expect(plan.held).toEqual([]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].provider).toBe("supabase");
    expect(plan.steps[0].keys.sort()).toEqual(
      (["video", "video_sd", "thumbnail"] as const).map((k) => legacyObjectKey(FOLDER, k)).sort(),
    );
    expect(plan.steps[0].mustAnswer).toHaveLength(3);
  });

  it("holds a row that was rolled back, or changed since", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const rolledBack: LogEntry = { v: 1, type: "rolled-back", at: "2026-11-13T00:00:00Z", id: "clip1", fields: ["videoUrl"] };
    expect(
      planDeleteOld([...world.log, rolledBack], world.currentRows(), { now: days(30), minAgeDays: 14, bases }).steps,
    ).toEqual([]);

    world.rows.get("clip1")!.thumbnailUrl = legacyUrl("thumbnail", 9);
    const plan = planDeleteOld(world.log, world.currentRows(), { now: days(30), minAgeDays: 14, bases });
    expect(plan.steps).toEqual([]);
    expect(plan.held[0].reason).toContain("no longer points at the migrated URL");
  });

  it("holds when another row still uses the old URL", async () => {
    const seeded = world.seed(row());
    const sharedStill = seeded.thumbnailUrl;
    await migrateRow(seeded, world.deps(), EXECUTE);
    world.rows.set("clip2", { ...row({ id: "clip2", externalId: "other" }), thumbnailUrl: sharedStill });

    const plan = planDeleteOld(world.log, world.currentRows(), { now: days(30), minAgeDays: 14, bases });
    expect(plan.steps).toEqual([]);
    expect(plan.held[0].reason).toContain("a row still uses the old URL");
  });

  it("never offers a content-addressed key, which other rows may share", async () => {
    // Stage 2: the "old" objects on Supabase are themselves hashed keys.
    const stage1 = world.seed(row());
    await migrateRow(stage1, world.deps(), EXECUTE);
    const r2 = new World(R2_BASE, "r2");
    r2.objects = world.objects;
    r2.rows = world.rows;
    await migrateRow(world.rows.get("clip1")!, r2.deps(), EXECUTE);

    const plan = planDeleteOld(r2.log, world.currentRows(), {
      now: days(30),
      minAgeDays: 14,
      bases: { supabase: BASE, r2: R2_BASE },
    });
    expect(plan.steps).toEqual([]);
    expect(plan.held[0].reason).toContain("content-addressed");
  });

  it("holds an old URL that is on no configured provider", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const plan = planDeleteOld(world.log, world.currentRows(), { now: days(30), minAgeDays: 14, bases: { r2: R2_BASE } });
    expect(plan.steps).toEqual([]);
    expect(plan.held[0].reason).toContain("on no configured provider");
  });
});

describe("parseLog", () => {
  it("reads whole lines and ignores a torn last one", async () => {
    await migrateRow(world.seed(row()), world.deps(), EXECUTE);
    const text = world.log.map((e) => JSON.stringify(e)).join("\n") + '\n{"v":1,"type":"row","at":"2026';
    const parsed = parseLog(text);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((e) => e.type)).toEqual(["row", "applied"]);
    const fields: ClipField[] = ["videoUrl", "videoUrlSd", "thumbnailUrl"];
    if (parsed[0].type === "row") expect(Object.keys(parsed[0].fields).sort()).toEqual([...fields].sort());
  });
});
