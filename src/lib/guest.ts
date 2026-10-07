// Shared constants for the zero-friction guest flow (username-only play ->
// leaderboard, then an email-save prompt). Kept in one place so the quiz hook
// that emits the milestone and the prompt component that listens agree.

/** How many clips a guest spots before we prompt them to save with an email. */
export const GUEST_SAVE_PROMPT_AT = 3;

/** Window event fired when a guest reaches the save-prompt threshold. */
export const GUEST_MILESTONE_EVENT = "fishspotter:guest-milestone";

/**
 * Window event for a guest who ASKED to save (the prize card's "Add my email").
 * Unlike the milestone, it opens the prompt even after an earlier "Not now".
 */
export const GUEST_SAVE_REQUEST_EVENT = "fishspotter:guest-save-request";

/** Window event fired once a guest's account is saved. Detail: { emailSent }. */
export const GUEST_SAVED_EVENT = "fishspotter:guest-saved";

/**
 * Window event fired when a guest's lifetime Pebbles reach the prize target
 * (the quiz hook, after each answer). A guest can earn the prize in one
 * sitting, and with no email on the account PEBL has no way to post it: the
 * session cookie lapses a week after their last visit and the account is
 * orphaned. FrankTheShark, 7 Oct 2026, 2,154 Pebbles in two hours, unreachable.
 * GuestSavePrompt opens a prize version of the save prompt, with its own
 * once-per-tab "Not now", so dismissing the clip-3 nudge doesn't hide it.
 */
export const GUEST_PRIZE_EVENT = "fishspotter:guest-prize";
