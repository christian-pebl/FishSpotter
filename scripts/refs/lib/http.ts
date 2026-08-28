/**
 * Polite HTTP helper shared by the reference resolver and verifier.
 *
 * Every external source in this pipeline is a small public institution
 * (MarLIN, WoRMS, FishBase, BTO), so requests are serialised with a delay
 * rather than fanned out, and identify themselves.
 */

const UA =
  "Mozilla/5.0 (compatible; FishSpotter-reference-checker/1.0; +https://fish-spotter.vercel.app; contact hello@pebl-cic.co.uk)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchTextResult = {
  ok: boolean;
  status: number;
  url: string;
  text: string;
  /** Response content-type, used to tell a PDF from an HTML error page. */
  contentType?: string;
  error?: string;
};

/** GET a URL as text, with retry on transient failures. Never throws. */
export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; retries?: number; accept?: string } = {},
): Promise<FetchTextResult> {
  const { timeoutMs = 30_000, retries = 2, accept = "text/html,application/xhtml+xml,*/*" } = opts;
  let last: FetchTextResult = { ok: false, status: 0, url, text: "", error: "not attempted" };
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1200 * attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept },
        redirect: "follow",
        signal: ctrl.signal,
      });
      const text = await res.text();
      last = {
        ok: res.ok,
        status: res.status,
        url: res.url || url,
        text,
        contentType: res.headers.get("content-type") ?? undefined,
      };
      // 4xx other than 429 is a settled answer, not worth retrying.
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return last;
    } catch (e) {
      last = { ok: false, status: 0, url, text: "", error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

/** GET a URL as JSON. Returns null on any failure (never throws). */
export async function fetchJson<T>(url: string, opts?: { timeoutMs?: number; retries?: number }): Promise<T | null> {
  const r = await fetchText(url, { ...opts, accept: "application/json" });
  if (!r.ok) return null;
  try {
    return JSON.parse(r.text) as T;
  } catch {
    return null;
  }
}

/** Strip tags/entities so a page can be searched for a species name as prose. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    // Numeric entities, decimal and hex. The Wildlife Trusts write an
    // apostrophe as &#039;, which a literal "&#39;" replacement misses because
    // of the leading zero, and "Lion&#039;s mane jellyfish" then failed to
    // match "Lion's mane jellyfish".
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Case-insensitive, whitespace-tolerant containment test. */
export function mentions(haystack: string, needle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return norm(haystack).includes(norm(needle));
}

/** The contents of the document's <title> element, or "" if it has none. */
export function pageTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? pageText(m[1]) : "";
}

export type IdentityMatch = {
  ok: boolean;
  matchedOn?: string;
  matchedIn?: "title" | "title+body";
  reason: string;
};

/**
 * Decide whether a fetched page is genuinely ABOUT a species, rather than
 * merely mentioning it.
 *
 * The distinction is load-bearing. MarLIN's page for the common mussel names
 * both plaice and dab in its body text, so a body-containment test bound two
 * unrelated flatfish to a bivalve. The title is the identity claim the page
 * makes about itself, so that is what gets tested.
 *
 *   title carries a binomial                         -> accept (MarLIN, FishBase)
 *   title carries the common name, body the binomial -> accept (BTO, whose
 *                                                       titles are vernacular)
 *   anything else                                    -> reject
 */
export function identityMatch(
  html: string,
  opts: { binomials: string[]; commonName?: string; kind?: string },
): IdentityMatch {
  const title = pageTitle(html);

  /**
   * Journal articles are the exception, and they are the exception because the
   * title test was built for species DATABASE pages.
   *
   * A database page's title is its subject, so "is the binomial in the title"
   * is exactly the right question. A paper's title is its FINDING: "Stable
   * isotopes reveal the effect of trawl fisheries on the diet of commercially
   * important species" is a perfectly good source for a diet claim and names no
   * species at all. Applying the database rule to papers rejected our best
   * sources by construction (finding F12 of the 28 Aug audit).
   *
   * So for a paper the species must be named in the title OR in the opening of
   * the document, which in practice is the abstract. That is a bounded
   * relaxation, not a return to "mentioned anywhere": a binomial in an abstract
   * is what the paper is about, whereas a binomial 40 pages into a species
   * database page is a cross-reference, which is how MarLIN's mussel page
   * bound two flatfish.
   */
  if (opts.kind === "journal") {
    const opening = pageText(html).slice(0, 3000);
    const hit = opts.binomials.find((b) => mentions(title, b) || mentions(opening, b));
    if (hit) {
      return {
        ok: true,
        matchedOn: hit,
        matchedIn: mentions(title, hit) ? "title" : "title+body",
        reason: `paper names ${hit} in its ${mentions(title, hit) ? "title" : "abstract"}`,
      };
    }
    return {
      ok: false,
      reason: `paper names none of ${opts.binomials.join(" | ")} in its title or abstract`,
    };
  }

  if (!title) return { ok: false, reason: "page has no title to identify it by" };

  const inTitle = opts.binomials.find((b) => mentions(title, b));
  if (inTitle) return { ok: true, matchedOn: inTitle, matchedIn: "title", reason: `title names ${inTitle}` };

  if (opts.commonName && mentions(title, opts.commonName)) {
    const body = pageText(html);
    const inBody = opts.binomials.find((b) => mentions(body, b));
    if (inBody) {
      return {
        ok: true,
        matchedOn: inBody,
        matchedIn: "title+body",
        reason: `title names "${opts.commonName}" and body names ${inBody}`,
      };
    }
    return { ok: false, reason: `title names "${opts.commonName}" but no binomial appears in the body` };
  }

  return { ok: false, reason: `title is "${title.slice(0, 80)}", which names neither the binomial nor the common name` };
}
