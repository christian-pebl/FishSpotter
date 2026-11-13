/**
 * Moving live clips onto content-addressed keys: the part that can be tested.
 *
 * `scripts/migrate-clip-keys.ts` is the command line around this. Everything
 * that touches the outside world (storage, the database, the network, the
 * clock, the log file) is passed in as `MigrationDeps`, so the tests drive the
 * real logic against fakes and can prove the properties that matter:
 *
 *   - a dry run writes nothing, anywhere;
 *   - a row changes only after every one of its new URLs has answered with the
 *     same number of bytes as the object it replaces;
 *   - the log line that makes rollback possible is written BEFORE the row
 *     changes, never after;
 *   - rollback and clean-up act only on rows that still look the way the log
 *     says the migration left them.
 *
 * The old objects are never touched by a migration run. Deleting them is a
 * separate step (`planDeleteOld`) with its own age gate, because for as long
 * as they exist a rollback is one database update per row.
 */
import { isContentKey, isContentKeyFor, keyOfPublicUrl, objectKey, type StorageKind } from "./object-keys";

export type ClipField = "videoUrl" | "videoUrlSd" | "thumbnailUrl";

export const CLIP_FIELDS: readonly ClipField[] = ["videoUrl", "videoUrlSd", "thumbnailUrl"];

export const FIELD_KIND: Record<ClipField, StorageKind> = {
  videoUrl: "video",
  videoUrlSd: "video_sd",
  thumbnailUrl: "thumbnail",
};

const FIELD_CONTENT_TYPE: Record<ClipField, string> = {
  videoUrl: "video/mp4",
  videoUrlSd: "video/mp4",
  thumbnailUrl: "image/jpeg",
};

export interface ClipRow {
  id: string;
  externalId: string;
  videoUrl: string;
  videoUrlSd: string | null;
  thumbnailUrl: string;
}

/** The storage a clip is moving TO. A subset of StorageDriver. */
export interface MigrationTarget {
  provider: string;
  publicBase: string;
  publicUrlForKey(key: string): string;
  uploadObject(
    key: string,
    body: Buffer,
    contentType: string,
    options?: { immutable?: boolean },
  ): Promise<string>;
}

/** What one byte of a URL told us (a ranged GET, never a HEAD). */
export interface Probe {
  ok: boolean;
  status: number;
  /** Size of the whole object, or null when the server did not say. */
  length: number | null;
  etag: string | null;
}

export interface FetchedBytes {
  body: Buffer;
  /** Where the bytes came from, for the report: "cache", "mirror", "download". */
  source: string;
}

export interface MigrationDeps {
  target: MigrationTarget;
  probe(url: string): Promise<Probe>;
  fetchBytes(
    url: string,
    live: Probe,
    hint: { externalId: string; field: ClipField },
  ): Promise<FetchedBytes>;
  updateRow(id: string, data: Partial<Record<ClipField, string>>): Promise<void>;
  appendLog(entry: LogEntry): void;
  now(): Date;
  sleep(ms: number): Promise<void>;
}

/* -------------------------------------------------------------------------- *
 * The log
 * -------------------------------------------------------------------------- */

export interface LoggedField {
  old: string;
  new: string;
  bytes: number;
}

export type LogEntry =
  /** Written before the row changes. Everything rollback needs. */
  | {
      v: 1;
      type: "row";
      at: string;
      id: string;
      externalId: string;
      provider: string;
      fields: Partial<Record<ClipField, LoggedField>>;
    }
  /** Written after the row changed. */
  | { v: 1; type: "applied"; at: string; id: string }
  | { v: 1; type: "rolled-back"; at: string; id: string; fields: ClipField[] }
  | { v: 1; type: "deleted-old"; at: string; id: string; provider: string; keys: string[] };

/** Parses a JSON-lines log. A torn last line (a crash mid-write) is ignored. */
export function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry && entry.v === 1 && typeof entry.type === "string") entries.push(entry);
    } catch {
      // Not a complete line: nothing after it can be trusted to be one either,
      // but earlier lines are whole, and they are what rollback needs.
    }
  }
  return entries;
}

/* -------------------------------------------------------------------------- *
 * Planning
 * -------------------------------------------------------------------------- */

export type FieldState =
  | { field: ClipField; state: "absent" }
  | { field: ClipField; state: "done"; url: string }
  | { field: ClipField; state: "todo"; url: string };

/**
 * Where one URL of a row stands. "done" means it already points at a
 * content-addressed key ON THE TARGET: a hashed key on another provider is
 * still "todo", which is what makes the later move to R2 the same operation.
 */
export function fieldState(row: ClipRow, field: ClipField, publicBase: string): FieldState {
  const url = row[field];
  if (!url) return { field, state: "absent" };
  const key = keyOfPublicUrl(url, publicBase);
  if (key && isContentKeyFor(FIELD_KIND[field], key)) return { field, state: "done", url };
  return { field, state: "todo", url };
}

export interface FieldReport {
  field: ClipField;
  oldUrl: string;
  bytes: number;
  /** Null in a dry run that did not read the bytes: the name is their hash. */
  newKey: string | null;
  newUrl: string | null;
  source: string | null;
}

export interface RowReport {
  id: string;
  externalId: string;
  status: "already" | "planned" | "migrated" | "failed";
  fields: FieldReport[];
  error?: string;
}

export interface MigrateOptions {
  /** False (the default everywhere) is a dry run: nothing is written. */
  execute: boolean;
  /** In a dry run, read the bytes anyway so the report shows the exact names. */
  hash: boolean;
  /** How often to re-check a new URL before giving up on it. */
  verifyAttempts?: number;
  verifyDelayMs?: number;
}

async function verifyNewUrl(
  deps: MigrationDeps,
  url: string,
  bytes: number,
  attempts: number,
  delayMs: number,
): Promise<void> {
  let last = "no attempt made";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const probe = await deps.probe(url);
    if (probe.ok && probe.length === bytes) return;
    last = probe.ok
      ? `answered ${probe.status} with ${probe.length} bytes, expected ${bytes}`
      : `answered ${probe.status}`;
    if (attempt < attempts) await deps.sleep(delayMs);
  }
  throw new Error(`new URL failed its check (${last}): ${url}`);
}

/**
 * Plans, and with `execute` performs, the move of one row.
 *
 * Order of work when executing, and why:
 *   1. read every old object (and check it against what is live);
 *   2. upload every new object;
 *   3. check every new URL answers with the same length;
 *   4. write the log line;
 *   5. change the row, in one update;
 *   6. note that it was applied.
 * A failure at any of 1 to 4 leaves the row exactly as it was. A failure at 5
 * leaves a log line for a row that did not change, which rollback and clean-up
 * both recognise (they compare the row with the log before acting).
 */
export async function migrateRow(
  row: ClipRow,
  deps: MigrationDeps,
  options: MigrateOptions,
): Promise<RowReport> {
  const report: RowReport = { id: row.id, externalId: row.externalId, status: "already", fields: [] };
  const todo = CLIP_FIELDS.map((f) => fieldState(row, f, deps.target.publicBase)).filter(
    (s): s is Extract<FieldState, { state: "todo" }> => s.state === "todo",
  );
  if (todo.length === 0) return report;

  const bodies = new Map<ClipField, Buffer>();
  try {
    for (const { field, url } of todo) {
      const live = await deps.probe(url);
      if (!live.ok || live.length === null) {
        throw new Error(`${field}: the current object did not answer (status ${live.status}): ${url}`);
      }
      const entry: FieldReport = {
        field,
        oldUrl: url,
        bytes: live.length,
        newKey: null,
        newUrl: null,
        source: null,
      };
      if (options.execute || options.hash) {
        const fetched = await deps.fetchBytes(url, live, { externalId: row.externalId, field });
        if (fetched.body.length !== live.length) {
          throw new Error(
            `${field}: read ${fetched.body.length} bytes from ${fetched.source}, the live object is ${live.length}`,
          );
        }
        entry.newKey = objectKey(FIELD_KIND[field], fetched.body);
        entry.newUrl = deps.target.publicUrlForKey(entry.newKey);
        entry.source = fetched.source;
        bodies.set(field, fetched.body);
      }
      report.fields.push(entry);
    }

    if (!options.execute) {
      report.status = "planned";
      return report;
    }

    for (const entry of report.fields) {
      await deps.target.uploadObject(
        entry.newKey!,
        bodies.get(entry.field)!,
        FIELD_CONTENT_TYPE[entry.field],
        { immutable: true },
      );
    }
    for (const entry of report.fields) {
      await verifyNewUrl(
        deps,
        entry.newUrl!,
        entry.bytes,
        options.verifyAttempts ?? 4,
        options.verifyDelayMs ?? 1500,
      );
    }

    const fields: Partial<Record<ClipField, LoggedField>> = {};
    const data: Partial<Record<ClipField, string>> = {};
    for (const entry of report.fields) {
      fields[entry.field] = { old: entry.oldUrl, new: entry.newUrl!, bytes: entry.bytes };
      data[entry.field] = entry.newUrl!;
    }
    deps.appendLog({
      v: 1,
      type: "row",
      at: deps.now().toISOString(),
      id: row.id,
      externalId: row.externalId,
      provider: deps.target.provider,
      fields,
    });
    await deps.updateRow(row.id, data);
    deps.appendLog({ v: 1, type: "applied", at: deps.now().toISOString(), id: row.id });
    report.status = "migrated";
    return report;
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.message : String(error);
    return report;
  }
}

/* -------------------------------------------------------------------------- *
 * Rollback
 * -------------------------------------------------------------------------- */

export interface RollbackStep {
  id: string;
  externalId: string;
  /** Fields to put back, with the URL each returns to. */
  restore: Partial<Record<ClipField, string>>;
  /** Fields left alone because the row no longer holds what the log wrote. */
  skipped: { field: ClipField; reason: string }[];
}

/**
 * What a rollback would do: a database update per row, nothing else. A field
 * is restored only while the row still holds the URL the migration wrote; if
 * something has changed it since (a re-cut synced in, say), it is left alone.
 * The last "row" entry for an id wins, and an id already rolled back or whose
 * old objects were deleted is not offered again.
 */
export function planRollback(entries: LogEntry[], rows: ClipRow[]): RollbackStep[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const latest = new Map<string, Extract<LogEntry, { type: "row" }>>();
  const closed = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type === "row") {
      latest.set(entry.id, entry);
      closed.delete(entry.id);
    } else if (entry.type === "rolled-back") {
      closed.set(entry.id, "already rolled back");
    } else if (entry.type === "deleted-old") {
      closed.set(entry.id, "its old objects were deleted");
    }
  }

  const steps: RollbackStep[] = [];
  for (const entry of latest.values()) {
    const step: RollbackStep = { id: entry.id, externalId: entry.externalId, restore: {}, skipped: [] };
    const row = byId.get(entry.id);
    for (const field of CLIP_FIELDS) {
      const logged = entry.fields[field];
      if (!logged) continue;
      const why = closed.get(entry.id);
      if (why) step.skipped.push({ field, reason: why });
      else if (!row) step.skipped.push({ field, reason: "the row no longer exists" });
      else if (row[field] === logged.old) step.skipped.push({ field, reason: "already holds the old URL" });
      else if (row[field] !== logged.new) step.skipped.push({ field, reason: "changed since the migration" });
      else step.restore[field] = logged.old;
    }
    steps.push(step);
  }
  return steps;
}

/* -------------------------------------------------------------------------- *
 * Deleting the old objects (a later, separate decision)
 * -------------------------------------------------------------------------- */

export interface DeleteStep {
  id: string;
  externalId: string;
  provider: string;
  keys: string[];
  /** New URLs that must still answer before these keys may go. */
  mustAnswer: { url: string; bytes: number }[];
}

export interface DeletePlan {
  steps: DeleteStep[];
  held: { id: string; externalId: string; reason: string }[];
}

export interface DeleteOptions {
  now: Date;
  /** Old objects younger than this stay. 14 by default at the command line. */
  minAgeDays: number;
  /** Public base URL of each provider that may hold old objects. */
  bases: Partial<Record<string, string>>;
}

/**
 * Which old objects may be deleted. An old object goes only when ALL hold:
 * the row was migrated and not rolled back; long enough ago; every field the
 * log changed still points at the new URL; no row anywhere still uses the old
 * URL; and the old key is a named key, never a content-addressed one.
 */
export function planDeleteOld(entries: LogEntry[], rows: ClipRow[], options: DeleteOptions): DeletePlan {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const inUse = new Set<string>();
  for (const row of rows) for (const field of CLIP_FIELDS) if (row[field]) inUse.add(row[field]!);

  const latest = new Map<string, Extract<LogEntry, { type: "row" }>>();
  const closed = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type === "row") {
      latest.set(entry.id, entry);
      closed.delete(entry.id);
    } else if (entry.type === "rolled-back") closed.set(entry.id, "rolled back");
    else if (entry.type === "deleted-old") closed.set(entry.id, "already deleted");
  }

  const plan: DeletePlan = { steps: [], held: [] };
  const minAgeMs = options.minAgeDays * 24 * 60 * 60 * 1000;
  for (const entry of latest.values()) {
    const hold = (reason: string) => plan.held.push({ id: entry.id, externalId: entry.externalId, reason });
    const why = closed.get(entry.id);
    if (why) {
      hold(why);
      continue;
    }
    const row = byId.get(entry.id);
    if (!row) {
      hold("the row no longer exists");
      continue;
    }
    const age = options.now.getTime() - new Date(entry.at).getTime();
    if (!(age >= minAgeMs)) {
      hold(`migrated ${(age / 86400000).toFixed(1)} days ago, under the ${options.minAgeDays}-day minimum`);
      continue;
    }

    let problem: string | null = null;
    const perProvider = new Map<string, string[]>();
    const mustAnswer: { url: string; bytes: number }[] = [];
    for (const field of CLIP_FIELDS) {
      const logged = entry.fields[field];
      if (!logged) continue;
      if (row[field] !== logged.new) {
        problem = `${field} no longer points at the migrated URL`;
        break;
      }
      if (inUse.has(logged.old)) {
        problem = `${field}: a row still uses the old URL`;
        break;
      }
      const home = Object.entries(options.bases).find(
        ([, base]) => base && keyOfPublicUrl(logged.old, base) !== null,
      );
      if (!home) {
        problem = `${field}: the old URL is on no configured provider`;
        break;
      }
      const key = keyOfPublicUrl(logged.old, home[1]!)!;
      if (isContentKey(key)) {
        problem = `${field}: the old key is content-addressed and may be shared`;
        break;
      }
      perProvider.set(home[0], [...(perProvider.get(home[0]) ?? []), key]);
      mustAnswer.push({ url: logged.new, bytes: logged.bytes });
    }
    if (problem) {
      hold(problem);
      continue;
    }
    for (const [provider, keys] of perProvider) {
      plan.steps.push({ id: entry.id, externalId: entry.externalId, provider, keys, mustAnswer });
    }
  }
  return plan;
}
