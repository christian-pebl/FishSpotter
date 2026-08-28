import type { SpotterRecord as SpotterRecordData } from "@/lib/spotter-record";
import { awardBadges, type AwardedBadge, type BadgeId } from "@/lib/badges";

/**
 * The Record block: the earned half of a spotter profile.
 *
 * Everything here is a credential the community handed out, not something bought
 * or accumulated by turning up. Badges come off the consensus layer (see
 * src/lib/spotter-record.ts), so none of them can be farmed by volume alone: the
 * scarce ones require other spotters to independently arrive at the same animal
 * you named.
 *
 * Takes the already-computed record rather than reading it: the derivation walks
 * every Answer row, and the profile's headline "Confirmed" tile needs the same
 * figures, so the page reads once and passes it down.
 */

/** Stroked line icons, one per ladder. No emoji (see the UI rules in CLAUDE.md). */
const ICONS: Record<BadgeId, React.ReactNode> = {
  confirmed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  pathfinder: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  current: (
    <>
      <path d="M3 8.5c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" />
      <path d="M3 14c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2" />
    </>
  ),
  pioneer: (
    <>
      <path d="M6 21V4.5" />
      <path d="M6 4.5h10l-2 3 2 3H6" />
    </>
  ),
  "deep-pioneer": (
    <>
      <path d="M12 4v16" />
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M5 12.5a7 7 0 0 0 14 0" />
      <path d="M8.5 8.5h7" />
    </>
  ),
};

const WEIGHT_STYLES: Record<AwardedBadge["weight"], string> = {
  standard: "bg-surface-muted text-navy-700 ring-1 ring-inset ring-navy-900/10",
  strong: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-500/35",
  elite: "bg-navy-900 text-teal-400 ring-1 ring-inset ring-teal-500/40",
};

function BadgePill({ badge }: { badge: AwardedBadge }) {
  const progress =
    badge.nextAt === null
      ? "Fully earned."
      : `Tier ${badge.tier} of ${badge.maxTier}. Next at ${badge.nextAt}.`;
  return (
    <li
      className={`flex items-center gap-2 rounded-full px-3 py-2 ${WEIGHT_STYLES[badge.weight]}`}
      title={`${badge.hint} ${progress}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[badge.id]}
      </svg>
      <span className="text-xs font-semibold">{badge.name}</span>
      <span className="text-xs tabular-nums opacity-70">{badge.count}</span>
    </li>
  );
}

export function SpotterRecord({ record }: { record: SpotterRecordData }) {
  const badges = awardBadges(record.counts);

  const nothingYet = badges.length === 0 && record.resolvedCalls === 0;

  return (
    <section className="pebl-surface rounded-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="pebl-eyebrow">Record</p>
        {record.confirmationRate !== null && (
          <p className="text-xs font-medium text-navy-900/60">
            {record.confirmedCalls} of {record.resolvedCalls} calls confirmed by
            the community
          </p>
        )}
      </div>

      {nothingYet ? (
        <p className="mt-3 text-sm leading-6 text-navy-900/60">
          Nothing here yet. Badges are earned when other spotters independently
          arrive at the same animal you named, so name a few clips and check back
          once the community catches up.
        </p>
      ) : (
        <>
          {badges.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {badges.map((b) => (
                <BadgePill key={b.id} badge={b} />
              ))}
            </ul>
          )}

          {record.firstToName.length > 0 && (
            <div className="mt-4 rounded-modal bg-surface-muted p-3">
              <p className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">
                First ever to name
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {record.firstToName.map((f) => f.label).join(", ")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-navy-900/55">
                Nobody had put a name to{" "}
                {record.firstToName.length === 1 ? "this animal" : "these animals"}{" "}
                on FishSpotter before you did, and the community agreed. Only one
                spotter can ever hold each.
              </p>
            </div>
          )}

          {record.rarestFind && record.rarestFind.tier !== "common" && (
            <p className="mt-3 text-xs text-navy-900/60">
              Rarest confirmed find:{" "}
              <span className="font-semibold text-navy-900">
                {record.rarestFind.label}
              </span>{" "}
              <span className="uppercase tracking-eyebrow text-[10px] text-teal-700">
                {record.rarestFind.tier}
              </span>
            </p>
          )}

          {badges.length === 0 && (
            <p className="mt-3 text-sm leading-6 text-navy-900/60">
              No badges yet. The community has resolved {record.resolvedCalls} of
              your calls so far.
            </p>
          )}
        </>
      )}
    </section>
  );
}
