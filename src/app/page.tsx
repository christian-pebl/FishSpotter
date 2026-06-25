import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { StatsBand } from "@/components/landing/StatsBand";
import { StepCards } from "@/components/landing/StepCards";
import { SpeciesMarquee, type MarqueeSpecies } from "@/components/landing/SpeciesMarquee";

// Hardening (conference prep): the landing page (the demo URL) renders the same
// for everyone (5 global queries, no per-user data), so ISR caches it. A QR-code
// crowd then hits a cached render (~1 rebuild/min) instead of re-running all 5
// queries on every request. Counts are at most 60s stale, which is fine here.
export const revalidate = 60;

const TRAITS = CATALOGUE;

// Labels can be a binomial (a traits key) or already a common name; map to
// a human-friendly display string either way.
function displayName(label: string): string {
  return TRAITS[label]?.commonName ?? label;
}

const COMMON_NAMES = Object.values(TRAITS)
  .map((t) => t.commonName)
  .filter((n): n is string => !!n);

// shape-class lookup keyed by BOTH binomial and common name, so a label
// resolves whether it arrives as a binomial, a common name, or junk.
const SHAPE_BY_NAME = new Map<string, string>();
// catalogue common-names grouped by shape-class, for same-class distractors.
const NAMES_BY_SHAPE = new Map<string, string[]>();
for (const [binomial, t] of Object.entries(TRAITS)) {
  if (!t.shapeClass) continue;
  SHAPE_BY_NAME.set(binomial, t.shapeClass);
  if (t.commonName) {
    SHAPE_BY_NAME.set(t.commonName, t.shapeClass);
    const arr = NAMES_BY_SHAPE.get(t.shapeClass) ?? [];
    arr.push(t.commonName);
    NAMES_BY_SHAPE.set(t.shapeClass, arr);
  }
}

export default async function HomePage() {
  const [featuredCandidates, distinctAnswerRows, clips, idsMade, photoRows] = await Promise.all([
    // Fetch top 25 so we can pick the first whose staffAnswer resolves to
    // a real catalogue species, skipping junk labels like "Fish" or "Crab".
    // Stable ordering via id tiebreaker (recordingDatetime is a nullable
    // string, so id ensures deterministic results when datetimes tie).
    prisma.snippet.findMany({
      where: { staffAnswer: { not: null } },
      orderBy: [{ recordingDatetime: "desc" }, { id: "desc" }],
      take: 25,
      select: { videoUrl: true, thumbnailUrl: true, staffAnswer: true, site: true },
    }),
    prisma.snippet.findMany({
      where: { staffAnswer: { not: null } },
      select: { staffAnswer: true },
      distinct: ["staffAnswer"],
    }),
    prisma.snippet.count(),
    // T-22: "identifications made" grows per-play and reads positively; the raw
    // spotter count (single digits) read as an empty product at first impression.
    prisma.answer.count(),
    prisma.speciesImage.findMany({
      orderBy: [{ curated: "desc" }, { ordering: "asc" }],
      take: 90,
      select: { scientificName: true, url: true, thumbUrl: true, webpThumbUrl: true, attribution: true },
    }),
  ]);

  // Prefer a clip whose staffAnswer maps to a real catalogue species so the
  // hero answer chip is a proper name, not junk. Fall back to first result.
  const featured =
    featuredCandidates.find((r) => COMMON_NAMES.includes(displayName(r.staffAnswer!))) ??
    featuredCandidates[0] ??
    null;

  // Hero answer. Resolve the raw staffAnswer label to a display name.
  const answer = featured?.staffAnswer ? displayName(featured.staffAnswer) : "Pollack";

  // Shape-aware distractors: prefer same shape-class as the answer so the
  // faux quiz looks realistic (no Crab offered against a Pollack).
  const answerShape =
    (featured?.staffAnswer && SHAPE_BY_NAME.get(featured.staffAnswer)) ||
    SHAPE_BY_NAME.get(answer) ||
    "fish";
  const sameShape = (n: string) => SHAPE_BY_NAME.get(n) === answerShape;

  const realSameClass = distinctAnswerRows
    .map((r) => displayName(r.staffAnswer as string))
    .filter((n) => n !== answer && COMMON_NAMES.includes(n) && sameShape(n));
  const catSameClass = (NAMES_BY_SHAPE.get(answerShape) ?? []).filter((n) => n !== answer);

  const distractors: string[] = [];
  for (const n of [...realSameClass, ...catSameClass, ...COMMON_NAMES]) {
    if (n !== answer && !distractors.includes(n)) distractors.push(n);
    if (distractors.length >= 3) break;
  }

  // All species the ID system can recognise.
  const speciesCount = COMMON_NAMES.length;

  // Marquee: dedupe photos to one per species, prefer thumb, cap at 14.
  const seen = new Set<string>();
  const marquee: MarqueeSpecies[] = [];
  for (const row of photoRows) {
    if (seen.has(row.scientificName)) continue;
    seen.add(row.scientificName);
    marquee.push({
      // Route C: prefer the PEBL-hosted WebP thumb, then the cached origin thumb.
      url: row.webpThumbUrl ?? row.thumbUrl ?? row.url,
      name: displayName(row.scientificName),
      attribution: row.attribution,
    });
    if (marquee.length >= 14) break;
  }

  return (
    <MarineBackdrop>
    <div className="flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 md:py-12"
      >
        {/* Hero */}
        <section
          className="relative py-10 md:py-14"
          aria-labelledby="hero-heading"
        >
          <div className={`relative grid items-center gap-10 ${featured ? "md:grid-cols-[1.1fr_0.9fr]" : ""}`}>
            <div>
              <h1
                id="hero-heading"
                className="font-brand-heading max-w-2xl text-4xl font-bold leading-tight text-navy-900 md:text-5xl"
              >
                Spot the species in real underwater footage.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-navy-900/70">
                Every species you ID helps PEBL monitor life on real UK reefs.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/feed"
                  className="pebl-button-primary inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-glow transition-shadow hover:shadow-glow-strong"
                >
                  Start spotting
                </Link>
              </div>
              <p className="mt-4 text-xs text-navy-900/60">
                Free, no card required.{" "}
                <Link href="/auth/signin?isSignUp=1" className="underline hover:text-navy-900">
                  Create a profile
                </Link>
                ,{" "}
                <Link href="/feed/browse" className="underline hover:text-navy-900">
                  browse the archive
                </Link>
                {" "}or{" "}
                <Link href="/leaderboard" className="underline hover:text-navy-900">
                  view the leaderboard
                </Link>
                .
              </p>
            </div>

            {featured && (
              <HeroPreview
                videoUrl={featured.videoUrl}
                poster={featured.thumbnailUrl}
                answer={answer}
                distractors={distractors}
                site={featured.site}
              />
            )}
          </div>
        </section>

        {/* Live stats */}
        <section aria-label="FishSpotter at a glance">
          <StatsBand clips={clips} species={speciesCount} idsMade={idsMade} speciesLabel="identifiable species" />
        </section>

        {/* How it works */}
        <section aria-label="How it works">
          <StepCards />
        </section>

        {/* Species showcase */}
        {marquee.length > 0 && (
          <section aria-labelledby="species-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="pebl-eyebrow text-xs">The catalogue</p>
                <h2 id="species-heading" className="mt-2 text-2xl font-bold text-navy-900">
                  What you&apos;ll find down there
                </h2>
              </div>
              <Link
                href="/feed/browse"
                className="hidden shrink-0 items-center text-sm font-semibold text-teal-700 underline hover:text-navy-900 sm:inline-flex sm:min-h-[44px]"
              >
                Browse the archive →
              </Link>
            </div>
            <SpeciesMarquee species={marquee} />
            <p className="mt-3 text-[11px] text-navy-900/70">
              Reference photos via{" "}
              <a
                href="https://www.inaturalist.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-navy-900"
              >
                iNaturalist
              </a>{" "}
              &amp;{" "}
              <a
                href="https://commons.wikimedia.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-navy-900"
              >
                Wikimedia
              </a>{" "}
              contributors, under{" "}
              <a
                href="https://creativecommons.org/licenses/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-navy-900"
              >
                Creative Commons
              </a>{" "}
              licences.
            </p>
          </section>
        )}

        {/* About PEBL */}
        <section className="pebl-surface rounded-card p-6 md:p-8" aria-labelledby="about-pebl">
          <p className="pebl-eyebrow text-xs">About PEBL</p>
          <h2 id="about-pebl" className="mt-2 text-2xl font-bold text-navy-900">
            Plant Ecology Beyond Land (PEBL) CIC
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-navy-900">
            PEBL is a Community Interest Company (no. 12076622, England and Wales) building accessible ecological data tools for coastal and seabed environments. FishSpotter is part of our marine monitoring programme: a citizen-science layer over real survey footage from PEBL deployments.
          </p>
          <Link
            href="https://pebl-cic.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center text-sm text-teal-700 underline"
          >
            Visit pebl-cic.co.uk →
          </Link>
        </section>
      </main>

      <footer className="border-t border-navy-900/8 px-4 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 text-xs text-navy-900/70">
          <p>
            © {new Date().getFullYear()} Plant Ecology Beyond Land (PEBL) CIC · Company no. 12076622
          </p>
          <nav className="flex flex-wrap items-center gap-x-4">
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center hover:text-navy-900">
              Privacy
            </Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center hover:text-navy-900">
              Terms
            </Link>
            <Link href="/accessibility" className="inline-flex min-h-[44px] items-center hover:text-navy-900">
              Accessibility
            </Link>
            <a href="mailto:hello@pebl-cic.co.uk" className="inline-flex min-h-[44px] items-center hover:text-navy-900">
              hello@pebl-cic.co.uk
            </a>
          </nav>
        </div>
      </footer>
    </div>
    </MarineBackdrop>
  );
}
