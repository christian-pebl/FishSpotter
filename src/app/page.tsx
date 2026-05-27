import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:py-12"
      >
        {/* Hero */}
        <section
          className="pebl-surface rounded-hero px-6 py-10 md:px-10 md:py-14"
          aria-labelledby="hero-heading"
        >
          <p className="pebl-eyebrow mb-3 text-xs">Protecting Ecology Beyond Land</p>
          <h1
            id="hero-heading"
            className="font-brand-heading max-w-3xl text-4xl font-bold leading-tight text-navy-900 md:text-6xl"
          >
            PEBL FishSpotter turns marine monitoring into a shared, playable observation feed.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-navy-900/72 md:text-lg">
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
              href="/auth/signin?isSignUp=1"
              className="inline-flex items-center justify-center min-h-[44px] rounded-full border border-teal-600 px-6 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              Create your spotter profile
            </Link>
            <Link
              href="/feed/browse"
              className="pebl-button-secondary inline-flex items-center justify-center min-h-[44px] rounded-full px-6 py-3 text-sm font-medium"
            >
              Explore archive
            </Link>
          </div>
          <p className="mt-4 text-xs text-navy-900/55">
            Free, no card required. Submit answers and join the leaderboard.
          </p>
        </section>

        {/* How it works */}
        <section className="grid gap-4 md:grid-cols-3" aria-label="How it works">
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">1 · Spot</p>
            <h2 className="mt-3 text-2xl font-bold text-navy-900">
              Spot the species in 5 seconds
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy-900/72">
              Each clip is a short underwater snippet. Pick the species from a small set of likely candidates — local marine life curated by PEBL ecologists.
            </p>
          </article>
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">2 · Compare</p>
            <h2 className="mt-3 text-2xl font-bold text-navy-900">
              Compare with the reference ID (when available)
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy-900/72">
              See the reference identification where one exists, how the wider community guessed, and an ecological-likelihood breakdown for the site and season. Clips without a reference are worth more.
            </p>
          </article>
          <article className="pebl-surface rounded-card p-5">
            <p className="pebl-eyebrow text-xs">3 · Streak</p>
            <h2 className="mt-3 text-2xl font-bold text-navy-900">
              Build a streak
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy-900/72">
              Identify clips on consecutive days to grow a streak. Get on the leaderboard once you&apos;ve submitted 10 identifications.
            </p>
          </article>
        </section>

        {/* About PEBL */}
        <section className="pebl-surface rounded-card p-6 md:p-8" aria-labelledby="about-pebl">
          <p className="pebl-eyebrow text-xs">About PEBL</p>
          <h2 id="about-pebl" className="mt-2 text-2xl font-bold text-navy-900">
            Plant Ecology Beyond Land (PEBL) CIC
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-navy-900/72">
            PEBL is a Community Interest Company (no. 12082722, England and Wales) building accessible ecological data tools for coastal and seabed environments. FishSpotter is part of our marine monitoring programme — a citizen-science layer over real survey footage from PEBL deployments.
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

      <footer className="border-t border-navy-900/8 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-navy-900/55">
          <p>
            © {new Date().getFullYear()} Plant Ecology Beyond Land (PEBL) CIC · Company no. 12082722
          </p>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-navy-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-navy-900">
              Terms
            </Link>
            <Link href="/accessibility" className="hover:text-navy-900">
              Accessibility
            </Link>
            <a href="mailto:hello@pebl-cic.co.uk" className="hover:text-navy-900">
              hello@pebl-cic.co.uk
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
