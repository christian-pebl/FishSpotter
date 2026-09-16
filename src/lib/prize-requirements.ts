/**
 * Everything a spotter must do to claim the prize, as a checklist they can
 * see.
 *
 * Until 16 Sep 2026 the claim rules were only visible as a refusal. The card
 * showed a Pebble bar, and a spotter who reached 2,000 then learned about the
 * other gates from one generic line ("more spotting history across more
 * days"). A production pull that day found the rules nobody could see were
 * the ones blocking everyone: 1 of 95 public spotters had spotted on five
 * separate days, and 38 had never confirmed their email, including five of
 * the top six by Pebbles. Shown up front, the day rule stops being a surprise
 * and becomes a reason to come back.
 *
 * Every measure here comes from `measureActivity` and the constants the claim
 * route itself judges by (src/lib/trust.ts), so the card can never tell a
 * spotter they are ready when the route would refuse them, except for the
 * one gate deliberately left off the list. The trust score is never shown
 * (docs/pebbles-anti-gaming-and-prizes-plan.md); when it is the only thing
 * left, `trustPending` lets the card say "almost there" without naming it.
 *
 * Pure: the page passes plain data in, the tests pass fixtures.
 */

import { PRIZE_TARGET_PEBBLES } from "@/lib/prize";
import {
  PRIZE_MIN_ACCOUNT_AGE_DAYS,
  PRIZE_MIN_ACTIVE_DAYS,
  PRIZE_MIN_ACTIVITY_SPAN_DAYS,
  isPrizeEligible,
  measureActivity,
} from "@/lib/trust";

const MS_PER_DAY = 86_400_000;

export type PrizeRequirementId = "pebbles" | "account" | "days" | "span";

/** What the card offers next to an unmet account requirement. */
export type PrizeAccountAction = "save-account" | "verify-email";

export interface PrizeRequirement {
  id: PrizeRequirementId;
  met: boolean;
  label: string;
  /** Progress or a next step while unmet; null once met. */
  detail: string | null;
  action: PrizeAccountAction | null;
}

export interface PrizeClaimStatus {
  /**
   * `isPrizeEligible`'s verdict, the same call the claim route makes. It does
   * not include the Pebble target, which the route checks separately and which
   * is the `pebbles` requirement here; a claim needs both.
   */
  eligible: boolean;
  /** Always in display order: pebbles, account, days, span. */
  requirements: PrizeRequirement[];
  /** Every listed requirement is met, yet the hidden trust gate still says no. */
  trustPending: boolean;
}

export interface PrizeClaimInput {
  earned: number;
  isGuest: boolean;
  emailVerified: Date | null;
  createdAt: Date;
  trustScore: number;
  /** This spotter's Answer.createdAt timestamps, any order. */
  answerDates: readonly Date[];
}

/**
 * The non-Pebble conditions in one sentence, for someone not signed in, who
 * sees the headline offer but no checklist. Built here, on the server, so the
 * client bundle never has to import the trust module for two numbers.
 */
export function prizeRulesSummary(): string {
  return `To claim it you also need a confirmed email address and at least ${PRIZE_MIN_ACTIVE_DAYS} separate spotting days, spread over ${PRIZE_MIN_ACTIVITY_SPAN_DAYS} days or more.`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function accountRequirement(input: PrizeClaimInput): PrizeRequirement {
  // A guest's User.email is a synthetic placeholder: there is nothing to
  // confirm until they attach a real address.
  if (input.isGuest) {
    return {
      id: "account",
      met: false,
      label: "Save your account with an email",
      detail: "Prizes go by post, so we need a way to reach you.",
      action: "save-account",
    };
  }
  if (!input.emailVerified) {
    return {
      id: "account",
      met: false,
      label: "Confirm your email address",
      detail: "We'll email you a link to click.",
      action: "verify-email",
    };
  }
  return { id: "account", met: true, label: "Email confirmed", detail: null, action: null };
}

export function prizeClaimStatus(input: PrizeClaimInput, now: Date): PrizeClaimStatus {
  const { distinctDays, spanDays } = measureActivity(input.answerDates);
  const accountAgeDays = (now.getTime() - input.createdAt.getTime()) / MS_PER_DAY;

  const pebblesMet = input.earned >= PRIZE_TARGET_PEBBLES;
  const daysMet = distinctDays >= PRIZE_MIN_ACTIVE_DAYS;
  // Answers can only follow account creation, so a long enough span implies
  // an old enough account. Both are checked anyway, exactly as the gate does.
  const spanMet =
    input.answerDates.length > 0 &&
    spanDays >= PRIZE_MIN_ACTIVITY_SPAN_DAYS &&
    accountAgeDays >= PRIZE_MIN_ACCOUNT_AGE_DAYS;
  const wholeSpanDays = Math.floor(spanDays);

  const requirements: PrizeRequirement[] = [
    {
      id: "pebbles",
      met: pebblesMet,
      label: `Earn ${PRIZE_TARGET_PEBBLES.toLocaleString("en-GB")} Pebbles`,
      detail: pebblesMet ? null : `${input.earned.toLocaleString("en-GB")} so far`,
      action: null,
    },
    accountRequirement(input),
    {
      id: "days",
      met: daysMet,
      label: `Spot on ${PRIZE_MIN_ACTIVE_DAYS} separate days`,
      detail: daysMet ? null : `${distinctDays} of ${PRIZE_MIN_ACTIVE_DAYS} so far`,
      action: null,
    },
    {
      id: "span",
      met: spanMet,
      label: `Spread them over at least ${PRIZE_MIN_ACTIVITY_SPAN_DAYS} days`,
      detail: spanMet
        ? null
        : input.answerDates.length === 0
          ? "The count starts with your first spot."
          : wholeSpanDays < 1
            ? "Your first and latest spots are less than a day apart so far."
            : `Your first and latest spots are ${plural(wholeSpanDays, "day", "days")} apart so far.`,
      action: null,
    },
  ];

  const { eligible } = isPrizeEligible(
    {
      emailVerified: input.isGuest ? null : input.emailVerified,
      createdAt: input.createdAt,
      trustScore: input.trustScore,
      answerDates: input.answerDates,
    },
    now,
  );

  const allListedMet = requirements.every((r) => r.met);
  return { eligible, requirements, trustPending: allListedMet && !eligible };
}
