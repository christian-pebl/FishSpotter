import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { FARMS } from "@/lib/farms/catalogue";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { SUPPORT_EMAIL } from "@/lib/email/outcome";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";
import { StatsBand } from "@/components/landing/StatsBand";

/**
 * The story of the project, on one page (8 Sep 2026).
 *
 * Asked for directly by a new spotter: "is it a partnership among PEBL CIC,
 * WWF and the seaweed farms? Who's using the data, and for what? I couldn't
 * find a 'this is the story of this project' section." They were right that
 * there wasn't one. The only telling of it was a paragraph on the landing
 * page, and a signed-in spotter never sees the landing page: the middleware
 * sends them straight to /feed. This page is reachable from the menu, so it
 * is the first version of the story a player can actually find.
 *
 * Every claim here is one the site already makes elsewhere (the landing and
 * farms pages, the privacy policy, the legitimate-interests assessment) or a
 * fact of how the app works. Nothing about partners or data use is asserted
 * beyond what those say; the honest answer to "who else sees the data" is
 * the privacy policy, which this links to.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "The story behind FishSpotter: who films the clips, which seaweed farms host the cameras, who funds the monitoring, and what your identifications are used for.",
};

const SPECIES_COUNT = Object.values(CATALOGUE).filter((t) => !!t.commonName).length;

export default async function AboutPage() {
  const [clips, idsMade] = await Promise.all([
    prisma.snippet.count({ where: excludeBlockedSnippetsWhere() }).catch(() => 0),
    prisma.answer.count().catch(() => 0),
  ]);
  const farms = Object.values(FARMS);

  return (
    <MarineBackdrop>
      <div className="flex-1 overflow-y-auto">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
          <BackToFeed />

          <header className="mt-3">
            <p className="pebl-eyebrow text-xs">About the project</p>
            <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">
              The story behind FishSpotter
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-navy-900/80">
              FishSpotter is a citizen-science game built around real survey footage. Every clip
              is a few seconds from an underwater camera beneath a working UK seaweed farm, and
              every identification you make becomes part of a record of what lives there.
            </p>
            {(clips > 0 || idsMade > 0) && (
              <div className="mt-5 border-t border-navy-900/10 pt-4">
                <StatsBand
                  clips={clips}
                  species={SPECIES_COUNT}
                  idsMade={idsMade}
                  speciesLabel="species to spot"
                  variant="inline"
                />
              </div>
            )}
          </header>

          <section className="pebl-surface mt-6 rounded-card p-6 md:p-8" aria-labelledby="about-footage">
            <p className="pebl-eyebrow text-xs">What you are looking at</p>
            <h2 id="about-footage" className="mt-2 text-2xl font-bold text-navy-900">
              Real footage, exactly as the camera saw it
            </h2>
            <p className="mt-3 text-sm leading-7 text-navy-900">
              PEBL puts cameras on the farms&apos; lines and records the water around them. Its
              software then cuts out the moments where an animal was tracked, so each clip is a
              few seconds long, built around one creature, and colour-corrected for the depth it
              was filmed at. Nothing is staged. The murk, the swell and the animal that will not
              turn side-on are the real conditions of the job, which is exactly why a second pair
              of eyes on every clip is worth so much.
            </p>
          </section>

          <section className="pebl-surface mt-4 rounded-card p-6 md:p-8" aria-labelledby="about-who">
            <p className="pebl-eyebrow text-xs">Who is behind it</p>
            <h2 id="about-who" className="mt-2 text-2xl font-bold text-navy-900">
              A company, a funded project, and six farms
            </h2>
            <dl className="mt-4 space-y-4 text-sm leading-7 text-navy-900">
              <div>
                <dt className="font-semibold">PEBL CIC builds and runs it.</dt>
                <dd>
                  Plant Ecology Beyond Land (PEBL) is a Community Interest Company (no. 12076622,
                  England and Wales) building accessible ecological data tools for coastal and
                  seabed environments. FishSpotter is part of its marine monitoring programme: a
                  citizen-science layer over footage from PEBL&apos;s own deployments.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">The monitoring is a funded project with WWF.</dt>
                <dd>
                  PEBL monitors the water beneath six UK seaweed farms as part of a National
                  Lottery Climate Action Fund project with WWF. The fish you are spotting live in
                  the same water that grows the crop.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">The farms host the cameras.</dt>
                <dd>
                  They are working businesses, spread from Pembrokeshire to Skye. Most of what
                  they grow does not end up on a plate: it is dried, pressed and sprayed onto
                  fields as a biostimulant, a natural alternative to synthetic fertiliser that
                  helps crops grow stronger roots and resist drought. Each one has its own page.
                </dd>
              </div>
            </dl>
            <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {farms.map((farm) => (
                <li key={farm.slug}>
                  <Link href={`/farms/${farm.slug}`} className="group block">
                    <div className="relative aspect-square overflow-hidden rounded-modal bg-navy-900/10 ring-1 ring-navy-900/10">
                      {farm.media?.hero && (
                        /* eslint-disable-next-line @next/next/no-img-element -- local static asset */
                        <img
                          src={farm.media.hero.src}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-navy-900" title={farm.name}>
                      {farm.name}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/farms"
              className="mt-4 inline-flex min-h-[44px] items-center text-sm text-teal-700 underline"
            >
              Meet all six farms →
            </Link>
          </section>

          <section className="pebl-surface mt-4 rounded-card p-6 md:p-8" aria-labelledby="about-data">
            <p className="pebl-eyebrow text-xs">What your identifications are used for</p>
            <h2 id="about-data" className="mt-2 text-2xl font-bold text-navy-900">
              The crowd is the authority
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-navy-900">
              <p>
                There is no answer key. A clip is identified when three or more spotters
                independently agree on what is in it; that becomes the community&apos;s
                identification, and the spotters who called it earn Pebbles. Your own guess is
                recorded before you see anyone else&apos;s, so agreement means something.
              </p>
              <p>
                Those settled identifications, added up by site and by date, are how PEBL turns
                thousands of short clips into a record of which species are using each farm.
                That record supports PEBL&apos;s monitoring of the farms and UK marine
                biodiversity science more widely, which is the community-benefit mission the
                company exists for. Anything that leaves the app is anonymised and aggregated:
                it says what was seen where, never who saw it.
              </p>
              <p>
                Two more things, because you asked. Engagement figures (how many people played,
                and for how long) are reported to the funder, and only counted if you choose
                &ldquo;Accept&rdquo; on the cookie banner. And your data is never sold: there are
                no advertising networks or tracking pixels on the site.
              </p>
            </div>
            <Link
              href="/privacy"
              className="mt-4 inline-flex min-h-[44px] items-center text-sm text-teal-700 underline"
            >
              The full detail is in the privacy policy →
            </Link>
          </section>

          <section className="pebl-surface mt-4 rounded-card p-6 md:p-8" aria-labelledby="about-contact">
            <p className="pebl-eyebrow text-xs">Get in touch</p>
            <h2 id="about-contact" className="mt-2 text-2xl font-bold text-navy-900">
              Questions, footage, data
            </h2>
            <p className="mt-3 text-sm leading-7 text-navy-900">
              Whether you want to know more about the project, have a farm that could host a
              camera, or would like to use the aggregated results for research, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal-700 underline">
                {SUPPORT_EMAIL}
              </a>
              . PEBL&apos;s wider monitoring work is at{" "}
              <a
                href="https://pebl-cic.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline"
              >
                pebl-cic.co.uk
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </MarineBackdrop>
  );
}
