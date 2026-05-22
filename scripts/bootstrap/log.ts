/**
 * Small CLI logging helpers. All bootstrap modules use these so the
 * orchestrator's output is consistent and grep-able.
 */

/* eslint-disable no-console */

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

function colour(text: string, code: keyof typeof ANSI): string {
  return process.stdout.isTTY ? `${ANSI[code]}${text}${ANSI.reset}` : text;
}

export function info(msg: string): void {
  console.log(`${colour("ℹ", "cyan")} ${msg}`);
}

export function ok(msg: string): void {
  console.log(`${colour("✓", "green")} ${msg}`);
}

export function warn(msg: string): void {
  console.warn(`${colour("!", "yellow")} ${msg}`);
}

export function err(msg: string): void {
  console.error(`${colour("✗", "red")} ${msg}`);
}

export function step(title: string): void {
  console.log("");
  console.log(colour(`── ${title}`, "cyan"));
}

export function dim(msg: string): void {
  console.log(colour(msg, "dim"));
}
