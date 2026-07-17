import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveFarmSlug, allFarmSlugs } from "@/lib/farms/catalogue";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import type { FarmTag } from "@/lib/farms/traits";
import { FarmHero } from "@/components/farms/FarmHero";
import { FarmGallery } from "@/components/farms/FarmGallery";
import { FarmVideo } from "@/components/farms/FarmVideo";

export const revalidate = 3600;

const TAG_LABEL: Record<FarmTag, string> = {
  "lead-farm": "Lead monitoring farm",
  "community-owned": "Community owned",
  biostimulants: "Biostimulants",
  "oyster-restoration": "Oyster restoration",
  hatchery: "Own hatchery",
  crofting: "Crofting tradition",
  "bioplastics-pedigree": "Bioplastics pedigree",
  imta: "Multi-species farming",
};

export async function generateStaticParams() {
  return allFarmSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const farm = resolveFarmSlug(slug);
  if (!farm) return { title: "Farm not found" };
  const title = `${farm.name}: FishSpotter`;
  return { title, description: farm.mission };
}

export default async function FarmProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const farm = resolveFarmSlug(slug);
  if (!farm) notFound();

  const hasDeployments = farm.deploymentNames.length > 0;
  const [clipCount, speciesRows] = hasDeployments
    ? await Promise.all([
        prisma.snippet.count({
          where: { deployment: { in: farm.deploymentNames }, ...excludeBlockedSnippetsWhere() },
        }),
        prisma.snippet.findMany({
          where: {
            deployment: { in: farm.deploymentNames },
            staffAnswer: { not: null },
            ...excludeBlockedSnippetsWhere(),
          },
          distinct: ["staffAnswer"],
          select: { staffAnswer: true },
        }),
      ])
    : [0, []];
  const speciesCount = speciesRows.length;
  // A farm can have a deployment yet zero *visible* clips (e.g. its only clip is
  // blocklisted), so gate the stats on the real count, not just deploymentNames.
  const hasClips = clipCount > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
        <Link
          href="/feed"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted hover:text-teal-600"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to the feed
        </Link>

        {farm.media?.hero ? (
          <div className="mt-3">
            <FarmHero
              image={farm.media.hero}
              name={farm.name}
              place={farm.location.place}
              legalName={farm.legalName}
            />
          </div>
        ) : (
          <header className="mb-5 mt-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
              {farm.location.place}
            </p>
            <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">{farm.name}</h1>
            {farm.legalName && (
              <p className="mt-0.5 text-sm italic text-navy-900/60">{farm.legalName}</p>
            )}
          </header>
        )}

        {hasClips ? (
          <div className="pebl-surface mt-5 flex items-center gap-6 rounded-card p-4">
            <div>
              <p className="font-brand-heading text-h2 text-teal-600">{clipCount}</p>
              <p className="text-xs text-navy-900/60">clip{clipCount === 1 ? "" : "s"} filmed here</p>
            </div>
            {speciesCount > 0 && (
              <div>
                <p className="font-brand-heading text-h2 text-teal-600">{speciesCount}</p>
                <p className="text-xs text-navy-900/60">species identified here</p>
              </div>
            )}
            <p className="ml-auto max-w-[10rem] text-right text-[11px] text-navy-900/50">
              from PEBL&apos;s underwater cameras
            </p>
          </div>
        ) : (
          <div className="pebl-surface mt-5 rounded-card p-4 text-sm text-navy-900/70">
            Clips filmed at {farm.name} will appear in the feed as monitoring footage is published.
          </div>
        )}

        <blockquote className="mt-5 border-l-2 border-teal-400 pl-4 font-brand-heading text-h3 italic text-navy-900">
          &ldquo;{farm.mission}&rdquo;
        </blockquote>

        <section className="mt-6">
          <h2 className="font-brand-heading text-h3 text-navy-900">Kelp to crop</h2>
          <p className="mt-2 text-sm leading-relaxed text-navy-900/80">{farm.whyItMatters}</p>
        </section>

        {farm.media?.video && (
          <FarmVideo
            video={farm.media.video}
            poster={farm.media.hero?.src}
            farmName={farm.name}
          />
        )}

        {farm.media?.gallery && farm.media.gallery.length > 0 && (
          <FarmGallery images={farm.media.gallery} credit={farm.media.credit} />
        )}

        {farm.interview && farm.interview.soundbites.length > 0 && (
          <section className="mt-6">
            <h2 className="font-brand-heading text-h3 text-navy-900">
              In {farm.interview.personName}&apos;s words
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-eyebrow text-navy-900/45">
              From a PEBL interview, March 2026
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {farm.interview.soundbites.map((line, i) => (
                <li
                  key={i}
                  className="rounded-modal border border-teal-100 bg-teal-50/60 p-3 text-sm italic leading-relaxed text-navy-900/85"
                >
                  &ldquo;{line}&rdquo;
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="font-brand-heading text-h3 text-navy-900">How it started</h2>
          <p className="mt-2 text-sm leading-relaxed text-navy-900/80">{farm.founded.story}</p>
        </section>

        {farm.people.length > 0 && (
          <section className="mt-6">
            <h2 className="font-brand-heading text-h3 text-navy-900">Who&apos;s behind it</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {farm.people.map((person) => (
                <li key={person.name} className="text-sm text-navy-900/80">
                  <span className="font-semibold text-navy-900">{person.name}</span>
                  {person.role && <span className="text-navy-900/60"> · {person.role}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 flex flex-wrap gap-1.5">
          {farm.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[11px] font-medium text-navy-900/60"
            >
              {TAG_LABEL[tag]}
            </span>
          ))}
        </section>

        {farm.scale && <p className="mt-3 text-xs text-navy-900/50">{farm.scale}</p>}

        <section className="pebl-surface mt-6 rounded-card p-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">What they grow</p>
          <p className="mt-1 text-sm text-navy-900/80">{farm.products.join(" · ")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-navy-900/10 pt-3">
            <a
              href={farm.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
            >
              Visit {farm.name}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            {farm.social?.instagram && (
              <a href={farm.social.instagram} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-900/50 hover:text-teal-600">
                Instagram
              </a>
            )}
            {farm.social?.linkedin && (
              <a href={farm.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-900/50 hover:text-teal-600">
                LinkedIn
              </a>
            )}
            {farm.social?.facebook && (
              <a href={farm.social.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-900/50 hover:text-teal-600">
                Facebook
              </a>
            )}
          </div>
        </section>

        <section className="pebl-surface mt-5 rounded-card p-4 text-center">
          {hasClips ? (
            <>
              <p className="text-sm text-navy-900/80">
                See the fish that share this water with the kelp at {farm.name}.
              </p>
              <Link
                href={`/feed/browse?q=${encodeURIComponent(farm.deploymentNames[0])}`}
                className="pebl-button-primary mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                See clips from {farm.name}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-navy-900/80">Meet the other farms behind FishSpotter.</p>
              <Link
                href="/farms"
                className="pebl-button-primary mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                All six farms
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
