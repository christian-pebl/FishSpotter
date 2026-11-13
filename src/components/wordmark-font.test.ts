import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The display font file holds only the letters of the "FishSpotter" wordmark
 * (see src/app/layout.tsx). Any other text given `font-display` would fall
 * back, letter by letter, to a different face. This keeps the class on the
 * wordmark alone until someone regenerates the font with more glyphs.
 */
const SRC = join(process.cwd(), "src");
const WORDMARK = "FishSpotter";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("the wordmark font", () => {
  it("is applied in the header and nowhere else", () => {
    const users = sourceFiles(SRC)
      // The Tailwind class: not the `--font-display` variable, and not the CSS
      // `font-display:` descriptor.
      .filter((file) => /(?<![-\w])font-display(?![-\w:])/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(SRC.length + 1).split(sep).join("/"));
    expect(users).toEqual(["components/Header.tsx"]);
  });

  it("styles exactly the word the font was cut for", () => {
    const header = readFileSync(join(SRC, "components", "Header.tsx"), "utf8");
    const match = /className=\{`font-display[\s\S]*?>\s*([^<{]+?)\s*<\/span>/.exec(header);
    expect(match?.[1]).toBe(WORDMARK);
  });
});
