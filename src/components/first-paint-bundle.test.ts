import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * framer-motion is 41 KB over the wire. It is fine on the live feed, where the
 * animation is the product, but it must not be in the JavaScript a visitor
 * downloads before the first paint of the landing page or of any page's header.
 *
 * Everything reachable from the root layout and the landing page by a STATIC
 * import ends up in that first download. A dynamic `import()` (the side menu and
 * the Pebble bag's pouch) does not, so those are not followed. If this fails, it
 * prints the chain of imports that led to framer-motion: break it with a dynamic
 * import (see src/lib/useLazyComponent.ts) or replace the animation with CSS
 * (see src/components/landing/RevealOnView.tsx).
 */
const SRC = join(process.cwd(), "src");
const LIBRARY = "framer-motion";

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(from), spec);
  else return null; // a package; handled by name, not followed
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.tsx?$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Module specifiers a file imports (or re-exports) statically, type-only imports excluded. */
function staticImports(file: string): string[] {
  const code = readFileSync(file, "utf8");
  const found: string[] = [];
  const withClause = /^[ \t]*(?:import|export)\s+(?!type\b)[^;'"]*?\sfrom\s+["']([^"']+)["']/gm;
  const bare = /^[ \t]*import\s+["']([^"']+)["']/gm;
  for (const pattern of [withClause, bare]) {
    for (const match of code.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

/** The chain of files from `root` to the first one importing `target`, or null. */
function chainTo(root: string, target: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, path: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    const here = [...path, relative(SRC, file).split(sep).join("/")];
    for (const spec of staticImports(file)) {
      if (spec === target || spec.startsWith(`${target}/`)) return [...here, target];
      const next = resolveImport(file, spec);
      if (next) {
        const hit = walk(next, here);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(root, []);
}

describe("what loads before the first paint", () => {
  it("finds a static framer-motion import when there is one (the check itself works)", () => {
    expect(chainTo(join(SRC, "components", "SideMenu.tsx"), LIBRARY)).toEqual([
      "components/SideMenu.tsx",
      LIBRARY,
    ]);
    // The live feed does use it, through several components.
    expect(chainTo(join(SRC, "app", "feed", "page.tsx"), LIBRARY)).not.toBeNull();
  });

  it("keeps framer-motion out of the root layout (header, banners, dialogs)", () => {
    expect(chainTo(join(SRC, "app", "layout.tsx"), LIBRARY)).toBeNull();
  });

  it("keeps framer-motion out of the landing page", () => {
    expect(chainTo(join(SRC, "app", "page.tsx"), LIBRARY)).toBeNull();
  });

  it("keeps the header's two animated parts behind dynamic imports", () => {
    expect(chainTo(join(SRC, "components", "Header.tsx"), LIBRARY)).toBeNull();
    expect(chainTo(join(SRC, "components", "PebbleBag.tsx"), LIBRARY)).toBeNull();
    const header = readFileSync(join(SRC, "components", "Header.tsx"), "utf8");
    const bag = readFileSync(join(SRC, "components", "PebbleBag.tsx"), "utf8");
    expect(header).toMatch(/import\(\s*["']@\/components\/SideMenu["']\s*\)/);
    expect(bag).toMatch(/import\(\s*["']@\/components\/PebbleBagView["']\s*\)/);
  });
});
