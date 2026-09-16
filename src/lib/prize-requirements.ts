/**
 * Everything a spotter must do to claim the prize, as a checklist they can
 * see, and the one gate the claim route enforces.
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
 * The same day, children were found among the spotters, so the prize gained
 * two rules (src/lib/age.ts):
 *   - we must know the spotter's age before posting them anything;
 *   - nothing is posted to anyone under 18 without a parent's OK
 *     (src/lib/parental-consent.ts). An under-13 never gives us their own
 *     email, so for them a parent's agreement to the account is what stands
 *     in for a confirmed address.
 *
 * Every measure here comes from `measureActivity` and the constants the claim
 * route itself judges by (src/lib/trust.ts), and `prizeGate` is what that
 * route calls, so the card can never tell a spotter they are ready when the
 * route would refuse them, except for the one gate deliberately left off the
 * list. The trust score is never shown
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
import { isAgeKnown, isUnder13, prizeNeedsParentConsent } from "@/lib/age";
import type { ConsentSummary } from "@/lib/parental-consent-shared";

const MS_PER_DAY = 86_400_000;

export type PrizeRequirementId = "pebbles" | "age" | "account" | "parent" | "days" | "span";

/** What the card offers next to an unmet requirement. */
export type PrizeRequirementAction =
  | "save-account"
  | "verify-email"
  | "declare-age"
  | "ask-parent-account"
  | "ask-parent-prize";

/** @deprecated kept for existing imports; use PrizeRequirementAction. */
export type PrizeAccountAction = PrizeRequirementAction;

export interface PrizeRequirement {
  id: PrizeRequirementId;
  met: boolean;
  label: string;
  /** Progress or a next step while unmet; null once met. */
  detail: string | null;
  action: PrizeRequirementAction | null;
}

export interface PrizeClaimStatus {
  /**
   * `prizeGate`'s verdict, the same call the claim route makes. It does not
   * include the Pebble target, which the route checks separately and which is
   * the `pebbles` requirement here; a claim needs both.
   */
  eligible: boolean;
  /** In display order: pebbles, age?, account, parent?, days, span. */
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
  /** User.ageBracket, or null when never asked. */
  ageBand: string | null;
  /** Where this spotter's parent requests stand (src/lib/parental-consent.ts). */
  consents: ConsentSummary;
  /** When a parent agreed to an under-13's account, if they have. */
  accountConsentGrantedAt: Date | null;
}

/**
 * The non-Pebble conditions in one sentence, for someone not signed in, who
 * sees the headline offer but no checklist. Built here, on the server, so the
 * client bundle never has to import the trust module for two numbers.
 */
export function prizeRulesSummary(): string {
  return `To claim it you also need a confirmed email address and at least ${PRIZE_MIN_ACTIVE_DAYS} separate spotting days, spread over ${PRIZE_MIN_ACTIVITY_SPAN_DAYS} days or more. We post to UK addresses only, and under-18s need a parent or carer's OK.`;
}

/**
 * What the anti-gaming gate treats as a confirmed identity. For most spotters
 * that is their own confirmed email. An under-13 never gives us one, so a
 * parent's agreement to their account, which the parent gave by answering our
 * email, stands in for it.
 */
export function prizeIdentityConfirmedAt(input: PrizeClaimInput): Date | null {
  if (isUnder13(input.ageBand)) {
    return input.consents.account === "granted" ? input.accountConsentGrantedAt : null;
  }
  return input.isGuest ? null : input.emailVerified;
}

export type PrizeBlock = "age-required" | "account" | "parent-consent" | "activity";

export interface PrizeGateResult {
  eligible: boolean;
  /** Why not, most actionable first. Empty when eligible. */
  blocks: PrizeBlock[];
  /** isPrizeEligible's reasons, for the staff desk. */
  reasons: string[];
}

/**
 * The whole claim gate, apart from the Pebble target. POST /api/prize/claim
 * calls exactly this.
 */
export function prizeGate(input: PrizeClaimInput, now: Date): PrizeGateResult {
  const identity = prizeIdentityConfirmedAt(input);
  const verdict = isPrizeEligible(
    {
      emailVerified: identity,
      createdAt: input.createdAt,
      trustScore: input.trustScore,
      answerDates: input.answerDates,
    },
    now,
  );
  const blocks: PrizeBlock[] = [];
  if (!isAgeKnown(input.ageBand)) blocks.push("age-required");
  if (!identity) blocks.push("account");
  if (prizeNeedsParentConsent(input.ageBand) && input.consents.prize !== "granted") {
    blocks.push("parent-consent");
  }
  if (verdict.reasons.some((r) => r !== "email not verified")) blocks.push("activity");
  return { eligible: blocks.length === 0, blocks, reasons: verdict.reasons };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function ageRequirement(): PrizeRequirement {
  return {
    id: "age",
    met: false,
    label: "Tell us your age",
    detail: "We need to know before we can post anything.",
    action: "declare-age",
  };
}

function accountRequirement(input: PrizeClaimInput): PrizeRequirement {
  if (isUnder13(input.ageBand)) {
    const state = input.consents.account;
    if (state === "granted") {
      return {
        id: "account",
        met: true,
        label: "A grown-up has saved your account",
        detail: null,
        action: null,
      };
    }
    return {
      id: "account",
      met: false,
      label: "Ask a parent or carer to save your account",
      detail:
        state === "pending"
          ? "We've emailed them. Once they say yes, this ticks itself."
          : "We'll email them to ask. We never need your own email.",
      action: "ask-parent-account",
    };
  }
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

function parentRequirement(input: PrizeClaimInput): PrizeRequirement {
  const state = input.consents.prize;
  if (state === "granted") {
    return {
      id: "parent",
      met: true,
      label: "A parent or carer has said yes to the prize",
      detail: null,
      action: null,
    };
  }
  return {
    id: "parent",
    met: false,
    label: "Get a parent or carer's OK for the prize",
    detail:
      state === "pending"
        ? "We've emailed them. Once they say yes, this ticks itself."
        : "Spotters under 18 need a grown-up to agree before we post anything.",
    action: "ask-parent-prize",
  };
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
  ];
  if (!isAgeKnown(input.ageBand)) requirements.push(ageRequirement());
  requirements.push(accountRequirement(input));
  if (prizeNeedsParentConsent(input.ageBand)) requirements.push(parentRequirement(input));
  requirements.push(
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
  );

  const { eligible } = prizeGate(input, now);
  const allListedMet = requirements.every((r) => r.met);
  return { eligible, requirements, trustPending: allListedMet && !eligible };
}
