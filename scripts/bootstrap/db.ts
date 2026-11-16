/**
 * DB orchestration. Wraps the existing `npm run db:*` scripts in the
 * right order with friendly logging.
 *
 * Sequence (idempotent):
 *   1. `npm run db:push`         , apply pending schema changes
 *   2. `npm run db:seed-aliases` , populate SpeciesAlias if empty
 *   3. `npm run db:migrate-to-r2`, PLAN the move of snippets to R2 (only
 *                                    when STORAGE_PROVIDER=r2 is active).
 *      Since 12 Nov 2026 that name runs scripts/migrate-clip-keys.ts, which
 *      is a dry run unless given `--execute`: this step prints what would
 *      move and changes nothing. Moving clips is a decision, made by hand:
 *      `npm run db:migrate-clip-keys -- --execute --limit 3`, then `--all`.
 */

import { spawnSync } from "node:child_process";

export type StepRunner = (script: string) => StepOutcome;

export interface StepOutcome {
  script: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DbRunOptions {
  /** Run db:migrate-to-r2 (only useful after STORAGE_PROVIDER=r2 is set). */
  includeR2Migration?: boolean;
  /** Override for tests. */
  run?: StepRunner;
}

export function runDb(options: DbRunOptions = {}): StepOutcome[] {
  const scripts: string[] = ["db:push", "db:seed-aliases"];
  if (options.includeR2Migration) scripts.push("db:migrate-to-r2");
  const runner = options.run ?? defaultRunner;
  const outcomes: StepOutcome[] = [];
  for (const script of scripts) {
    const outcome = runner(script);
    outcomes.push(outcome);
    if (outcome.exitCode !== 0) break;
  }
  return outcomes;
}

const defaultRunner: StepRunner = (script) => {
  const child = spawnSync("npm", ["run", script], {
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    script,
    exitCode: child.status ?? -1,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
  };
};
