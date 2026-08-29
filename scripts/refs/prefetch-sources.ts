/**
 * Cache every registered source as PLAIN TEXT, once, so claim verification
 * reads from disk instead of re-fetching 339 URLs per pass.
 *
 * Verification is the slow half of the reference pipeline and almost all of
 * that cost is network: FishBase answers in ~30s, MarLIN rate-limits, and a
 * verification sweep that re-fetches per claim hits the same page a dozen
 * times. Fetching once and grepping the text afterwards makes the read pass
 * bounded by reading rather than by politeness delays.
 *
 * HTML is reduced to text here rather than at read time on purpose: the point
 * is that whatever reads a source next sees the same words a person would,
 * with no markup to skip and no chance of matching a claim against a class
 * name or a nav label.
 *
 * PDFs are stored as bytes and left for the PDF extractor; there is no useful
 * text to pull out of them over HTTP.
 *
 *   npx tsx --env-file=.env.local scripts/refs/prefetch-sources.ts
 *     --only <id>    one source
 *     --kind <kind>  every source of one kind
 *     --force        refetch even when a cached copy exists
 *     --concurrency  parallel fetches (default 4; be kind to MarLIN)
 */

import fs from "node:fs";
import path from "node:path";
import { REFERENCES } from "@/lib/references/catalogue";
import { fetchText } from "./lib/http";
import { htmlToText, safeName } from "./lib/cache";

const OUT = path.join(process.cwd(), ".refs-cache", "text");
const RAW = path.join(process.cwd(), ".refs-cache", "raw");
const INDEX = path.join(process.cwd(), ".refs-cache", "index.json");

type Row = {
  id: string; kind: string; url?: string; title: string;
  status: "ok" | "pdf" | "failed" | "skipped";
  httpStatus?: number; bytes?: number; file?: string; error?: string; fetchedOn: string;
};

async function main() {
  const argv = process.argv.slice(2);
  const arg = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  const only = arg("--only");
  const kind = arg("--kind");
  const force = argv.includes("--force");
  const concurrency = Number(arg("--concurrency") ?? 4);

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });

  const entries = Object.entries(REFERENCES.sources)
    .filter(([id, s]) => (!only || id === only) && (!kind || s.kind === kind));

  const index: Record<string, Row> = fs.existsSync(INDEX)
    ? JSON.parse(fs.readFileSync(INDEX, "utf8"))
    : {};

  let done = 0;
  const queue = [...entries];
  const today = new Date().toISOString().slice(0, 10);

  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const [id, s] = next;
      const file = `${safeName(id)}.txt`;
      const outPath = path.join(OUT, file);
      done++;
      if (!force && fs.existsSync(outPath) && fs.statSync(outPath).size > 200) {
        process.stdout.write(`  [${done}/${entries.length}] cached  ${id}\n`);
        continue;
      }
      if (!s.url) {
        index[id] = { id, kind: s.kind, title: s.title, status: "skipped", error: "no url", fetchedOn: today };
        continue;
      }
      // FishBase is genuinely slow (~30s); the default clipped it and looked
      // like an intermittent network fault rather than a short timeout.
      const res = await fetchText(s.url, { timeoutMs: 90_000, retries: 2 });
      const isPdf = (res.contentType ?? "").includes("pdf") || s.verifyMode === "pdf";
      if (!res.ok || !res.text) {
        index[id] = { id, kind: s.kind, url: s.url, title: s.title, status: "failed",
          httpStatus: res.status, error: res.error, fetchedOn: today };
        process.stdout.write(`  [${done}/${entries.length}] FAIL ${res.status} ${id}\n`);
        continue;
      }
      if (isPdf) {
        // Keep the bytes; a PDF has no text worth pulling out over HTTP.
        fs.writeFileSync(path.join(RAW, `${safeName(id)}.pdf`), Buffer.from(res.text, "binary"));
        index[id] = { id, kind: s.kind, url: s.url, title: s.title, status: "pdf",
          httpStatus: res.status, bytes: res.text.length, fetchedOn: today };
        process.stdout.write(`  [${done}/${entries.length}] pdf    ${id}\n`);
        continue;
      }
      const text = htmlToText(res.text);
      fs.writeFileSync(outPath, `SOURCE: ${id}\nTITLE: ${s.title}\nURL: ${s.url}\nFETCHED: ${today}\n\n${text}\n`, "utf8");
      index[id] = { id, kind: s.kind, url: s.url, title: s.title, status: "ok",
        httpStatus: res.status, bytes: text.length, file, fetchedOn: today };
      process.stdout.write(`  [${done}/${entries.length}] ok ${String(text.length).padStart(7)}  ${id}\n`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2));

  const tally = Object.values(index).reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1; return a;
  }, {});
  console.log("\nCached:", JSON.stringify(tally));
  console.log("Text in .refs-cache/text, index at .refs-cache/index.json");
}

// Only run when invoked directly. Nothing imports this module any more, but a
// script whose side effect is 339 network fetches should say so out loud.
const entry = process.argv[1] ?? "";
if (entry.endsWith("prefetch-sources.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
