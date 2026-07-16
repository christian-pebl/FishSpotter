// Shared constants for the zero-friction guest flow (username-only play ->
// leaderboard, then an email-save prompt). Kept in one place so the quiz hook
// that emits the milestone and the prompt component that listens agree.

/** How many clips a guest spots before we prompt them to save with an email. */
export const GUEST_SAVE_PROMPT_AT = 3;

/** Window event fired when a guest reaches the save-prompt threshold. */
export const GUEST_MILESTONE_EVENT = "fishspotter:guest-milestone";
