/**
 * The reference gate. Independently re-checks every source in
 * src/data/species-references.json against the live web (or the local PDF),
 * and records what it found in src/data/reference-verification.json.
 *
 * This is deliberately an EXTERNAL check. It does not import, trust or re-use
 * anything the resolver concluded: it takes only the URL and the strings the
 * source claims to contain, fetches the document itself, and decides. A gate
 * that verifies against its own subject proves only self-consistency, which is
 * worse than no gate because it manufactures confidence.
 *
 * What it CAN prove:  the link resolves, and the document names the species.
 * What it CANNOT prove: that the document supports the claim. That is
 * `claimSupported`, which only a read passage can set, and this script never
 * touches it.
 *
 *   npm run refs:verify              write results
 *   npm run refs:verify -- --check   read-only, non-zero exit on any failure (CI)
 *   npm run refs:verify -- --stale-only   only re-check sources not checked in 30 days
 */

import { promises as fs } from "fs";
import path from "path";
import { referenceFileSchema, type Source } from "../../src/lib/references/schema";
import { fetchJson, fetchText, identityMatch, mentions, pageText, sleep } from "./lib/http";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const OUT = path.join(process.cwd(), "src", "data", "reference-verification.json");
const TODAY = new Date().toISOString().slice(0, 10);
const DELAY_MS = 900;
const STALE_DAYS = 30;

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes("--check");
const STALE_ONLY = argv.includes("--stale-only");
const LIMIT = argv.includes("--limit") ? Number(argv[argv.indexOf("--limit") + 1]) : undefined;

type VerificationRecord = {
  status: "ok" | "unreachable" | "mismatch" | "blocked" | "unchecked-local";
  httpStatus: number;
  matchedOn?: string;
  checkedOn: string;
  note?: string;
};

function daysSince(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 86_400_000;
}


type CrossrefWork = {
  message?: {
    title?: string[];
    abstract?: string;
    "container-title"?: string[];
    issued?: { "date-parts"?: number[][] };
  };
};

/** The DOI a source carries, from its identifier or its id. */
function doiOf(id: string, source: Source): string | null {
  // Trailing punctuation must not be swallowed: an identifier written
  // "DOI:10.3354/meps031087;" made Crossref look up a DOI ending in a
  // semicolon and report a real paper as missing.
  const fromIdentifier = /10\.\d{4,9}\/[^\s;,)\]]+/.exec(source.identifier ?? "");
  if (fromIdentifier) return fromIdentifier[0].replace(/[.,;)]+$/, "");
  // Ids are minted as "doi:10.1098-rsos.171421": the slash is not id-safe.
  if (id.startsWith("doi:")) return id.slice(4).replace("-", "/").replace(/[.,;)]+$/, "");
  return null;
}

/**
 * Verify a journal article through Crossref rather than by scraping its landing
 * page.
 *
 * A DOI landing page is the wrong thing to test. Publishers serve bots a
 * JavaScript shell, a cookie interstitial or a 401, and the repository copies
 * return the REPOSITORY's title ("Plymouth Marine Science Electronic Archive")
 * rather than the article's. Crossref publishes the authoritative record as
 * JSON, so it answers both questions properly: does this DOI exist, and what is
 * the paper actually called.
 *
 * When Crossref has no abstract (common for older papers) the subject cannot be
 * confirmed automatically, and that is reported as such rather than passed.
 */
async function verifyJournal(id: string, source: Source, expect: string[]): Promise<VerificationRecord | null> {
  const doi = doiOf(id, source);
  if (!doi) return null;
  const work = await fetchJson<CrossrefWork>(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { timeoutMs: 30_000 },
  );
  const m = work?.message;
  if (!m) {
    return {
      status: "unreachable",
      httpStatus: 0,
      checkedOn: TODAY,
      note: `Crossref has no record for DOI ${doi}`,
    };
  }
  const title = (m.title ?? []).join(" ");
  const abstract = (m.abstract ?? "").replace(/<[^>]+>/g, " ");
  const haystack = `${title} ${abstract}`;
  const hit = expect.find((e) => mentions(haystack, e));
  if (hit) {
    return {
      status: "ok",
      httpStatus: 200,
      matchedOn: hit,
      checkedOn: TODAY,
      note: `Crossref: "${title.slice(0, 120)}"`,
    };
  }
  return {
    status: "mismatch",
    httpStatus: 200,
    checkedOn: TODAY,
    note: abstract
      ? `DOI is real ("${title.slice(0, 90)}") but neither its title nor abstract names ${expect.join(" | ")}`
      : `DOI is real ("${title.slice(0, 90)}") but Crossref holds no abstract, so the subject cannot be confirmed automatically; check by hand`,
  };
}

/** Verify one source. Local-only works are reported honestly, not passed. */
async function verify(id: string, source: Source): Promise<VerificationRecord> {
  if (!source.url) {
    return {
      status: "unchecked-local",
      httpStatus: 0,
      checkedOn: TODAY,
      note: source.localPath
        ? `held locally at ${source.localPath}; no public URL to check`
        : "no URL recorded",
    };
  }

  // A paper is verified through Crossref, not its landing page: see verifyJournal.
  if (source.kind === "journal") {
    const viaCrossref = await verifyJournal(id, source, source.expectText ?? []);
    if (viaCrossref) return viaCrossref;
  }

  // FishBase answers in ~30s, so a default timeout would report a live page as dead.
  const res = await fetchText(source.url, { timeoutMs: 90_000 });
  if (!res.ok) {
    // A 403/429 is a publisher refusing an automated client, which says nothing
    // about whether the citation is good. Distinguish it from a dead link so a
    // human knows which ones to check by hand rather than delete.
    const blocked = res.status === 403 || res.status === 429;
    return {
      status: blocked ? "blocked" : "unreachable",
      httpStatus: res.status,
      checkedOn: TODAY,
      note: blocked
        ? `publisher refused an automated request (http ${res.status}); check this one by hand`
        : (res.error ?? `http ${res.status}`),
    };
  }

  // A PDF has no <title> to test. Prove what can be proved (it is retrievable
  // and it is still a PDF) and say plainly that the species match rests on the
  // recorded page locator instead of an HTTP text match.
  if (source.verifyMode === "pdf") {
    const type = res.contentType ?? "";
    if (!/pdf/i.test(type)) {
      return {
        status: "mismatch",
        httpStatus: res.status,
        checkedOn: TODAY,
        note: `expected a PDF but the server returned "${type || "no content-type"}"`,
      };
    }
    return {
      status: "ok",
      httpStatus: res.status,
      matchedOn: "PDF retrieved",
      checkedOn: TODAY,
      note: "PDF retrievable; species match rests on the recorded page locator, not an HTTP text match",
    };
  }

  const expect = source.expectText ?? [];
  if (expect.length === 0) {
    return {
      status: "mismatch",
      httpStatus: res.status,
      checkedOn: TODAY,
      note: "source declares no expectText, so the link cannot be proved to be about the right species",
    };
  }

  // The page must say in its own title that it is about this species. A
  // mention in the body is not proof: MarLIN's common-mussel page names plaice
  // and dab too. WoRMS is the exception, being a data endpoint rather than an
  // article, so a body match is all it can offer.
  if (source.kind === "worms") {
    const text = pageText(res.text);
    const hit = expect.find((e) => mentions(text, e));
    if (!hit) {
      return {
        status: "mismatch",
        httpStatus: res.status,
        checkedOn: TODAY,
        note: `page resolved but did not contain any of: ${expect.join(" | ")}`,
      };
    }
    return { status: "ok", httpStatus: res.status, matchedOn: hit, checkedOn: TODAY };
  }

  const match = identityMatch(res.text, {
    binomials: expect,
    commonName: source.expectCommonName,
    kind: source.kind,
  });
  if (!match.ok) {
    return { status: "mismatch", httpStatus: res.status, checkedOn: TODAY, note: match.reason };
  }
  return { status: "ok", httpStatus: res.status, matchedOn: match.matchedOn, checkedOn: TODAY };
}

async function main() {
  const file = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));
  let previous: Record<string, VerificationRecord> = {};
  try {
    previous = JSON.parse(await fs.readFile(OUT, "utf8"));
  } catch {
    previous = {};
  }

  let ids = Object.keys(file.sources);
  if (STALE_ONLY) {
    ids = ids.filter((id) => {
      const p = previous[id];
      return !p || p.status !== "ok" || daysSince(p.checkedOn) > STALE_DAYS;
    });
  }
  if (LIMIT) ids = ids.slice(0, LIMIT);

  console.log(`Verifying ${ids.length} source(s)${CHECK_ONLY ? " (check only, no write)" : ""}\n`);

  const results: Record<string, VerificationRecord> = { ...previous };
  const failures: string[] = [];

  for (const [i, id] of ids.entries()) {
    const source = file.sources[id];
    await sleep(DELAY_MS);
    const rec = await verify(id, source);
    results[id] = rec;
    const mark =
      rec.status === "ok" ? "ok " : rec.status === "unchecked-local" || rec.status === "blocked" ? "-- " : "FAIL";
    console.log(
      `[${i + 1}/${ids.length}] ${mark} ${id}  ${rec.status}${rec.matchedOn ? ` (matched ${rec.matchedOn})` : ""}${rec.note ? ` :: ${rec.note}` : ""}`,
    );
    if (rec.status === "unreachable" || rec.status === "mismatch") {
      failures.push(`${id}: ${rec.status} :: ${rec.note ?? ""}`);
    }
  }

  // Report which species would be left citing nothing verifiable.
  const unbacked: string[] = [];
  for (const [name, entry] of Object.entries(file.species)) {
    const anyOk = entry.sourceIds.some((sid) => results[sid]?.status === "ok");
    if (!anyOk) unbacked.push(name);
  }

  const okCount = Object.values(results).filter((r) => r.status === "ok").length;
  console.log(
    `\n${okCount}/${Object.keys(results).length} source(s) verified; ${failures.length} failure(s) this run.`,
  );
  if (unbacked.length) {
    console.log(`\n${unbacked.length} species have no verified source at all:`);
    for (const n of unbacked) console.log(`  - ${n}`);
  }

  if (!CHECK_ONLY) {
    const sorted = Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(OUT, JSON.stringify(sorted, null, 2) + "\n", "utf8");
    console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
  }

  if (failures.length) {
    console.error(`\nFAILED:\n${failures.map((f) => "  - " + f).join("\n")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
