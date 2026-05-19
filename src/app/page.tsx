import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
        <section className="pebl-surface rounded-hero px-6 py-10 md:px-10 md:py-14" aria-labelledby="hero-heading">
          <p className="pebl-eyebrow mb-3 text-xs">
            Protecting Ecology Beyond Land
          </p>
          <h1 id="hero-heading" className="font-brand-heading max-w-3xl text-4xl font-bold leading-tight text-[color:var(--foreground)] md:text-6xl">
            PEBL FishSpotter turns marine monitoring into a shared, playable observation feed.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg">
            Explore short underwater sightings, identify the creature in view, compare your answer with the wider community,
            and build a daily streak that supports coastal and seabed observation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/feed"
              className="pebl-button-primary inline-flex items-center justify-center min-h-[44px] rounded-full px-6 py-3 text-sm font-semibold"
            >
              Start spotting
            </Link>
            <Link
              href="/feed/browse"
              className="pebl-button-secondary inline-flex items-center justify-center min-h-[44px] rounded-full px-6 py-3 text-sm font-medium"
            >
              Explore archive
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="How it works">
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">Marine monitoring</p>
            <h2 className="mt-3 text-2xl font-bold text-[color:var(--foreground)]">Short-form sightings</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Review real underwater clips from PEBL monitoring deployments and respond quickly from mobile or desktop.
            </p>
          </article>
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">Community insight</p>
            <h2 className="mt-3 text-2xl font-bold text-[color:var(--foreground)]">Compare answers</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              See how your identification compares with community consensus and the PEBL reference label for each sighting.
            </p>
          </article>
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">Daily engagement</p>
            <h2 className="mt-3 text-2xl font-bold text-[color:var(--foreground)]">Keep the streak alive</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Return regularly, log more sightings, and help build a stronger picture of ecological activity over time.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
