import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:py-12">
        <section className="pebl-surface rounded-[28px] px-6 py-10 md:px-10 md:py-14">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-[color:var(--primary)]">
            Protecting Ecology Beyond Land
          </p>
          <h1 className="font-brand-heading max-w-3xl text-4xl leading-tight text-[color:var(--foreground)] md:text-6xl">
            PEBL FishSpotter turns marine monitoring into a shared, playable observation feed.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg">
            Explore short underwater sightings, identify the creature in view, compare your answer with the wider community,
            and build a daily streak that supports coastal and seabed observation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/feed"
              className="pebl-button-primary inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              Start spotting
            </Link>
            <Link
              href="/feed/browse"
              className="pebl-button-secondary inline-flex items-center rounded-full px-6 py-3 text-sm font-medium"
            >
              Explore archive
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="pebl-surface rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Marine monitoring</p>
            <h2 className="mt-3 text-2xl text-[color:var(--foreground)]">Short-form sightings</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Review real underwater clips from PEBL monitoring deployments and respond quickly from mobile or desktop.
            </p>
          </div>
          <div className="pebl-surface rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Community insight</p>
            <h2 className="mt-3 text-2xl text-[color:var(--foreground)]">Compare answers</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              See how your identification compares with community consensus and the PEBL reference label for each sighting.
            </p>
          </div>
          <div className="pebl-surface rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Daily engagement</p>
            <h2 className="mt-3 text-2xl text-[color:var(--foreground)]">Keep the streak alive</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              Return regularly, log more sightings, and help build a stronger picture of ecological activity over time.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
