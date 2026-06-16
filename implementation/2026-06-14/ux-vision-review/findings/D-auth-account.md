# Vision UX Review — Area D: Auth & Account

**Reviewer:** Senior product designer
**Area:** Auth & account (sign-in, sign-up, forgot-password, signed-in nav menu, account/settings)
**Finding prefix:** `D`

## Summary verdict

The auth surfaces are clean, on-brand, and unusually well-written for a citizen-science app: the copy frames sign-up as *joining a community* rather than a chore, the legal/consent layer (age band, terms checkbox, under-18 handling) is genuinely thoughtful, and the account/settings page is comprehensive and trustworthy (explicit GDPR data export, a clearly-labelled danger zone, granular privacy/notification controls). That foundation is strong. The weaknesses are three-fold. First, **friction and the blank-canvas problem**: every entry route is a password form. There are no one-tap social/passwordless options anywhere, and the sign-in/forgot-password screens are exactly the "bare `max-w-md` card on a blank background" the design rules forbid — no editorial content, no preview of what you're signing up for. Second, **the signed-in menu has an information-architecture hole**: it surfaces a wall of live-video playback controls (brightness, contrast, playback speed) but offers no visible path to *account, settings, profile, or sign out* — the user's name "UX Review" sits there as inert text, and the only routes to the account page are absent from the screenshot. Third, **smaller clarity/contrast issues**: faint muted-grey labels in the dark menu, a "(at least 8 characters)" hint that double-states a rule already enforced by inline validation, and an account page where the primary identity field has a small, low-contrast Save button. None are catastrophic, but the friction items directly suppress the conversion the brief cares about most: turning a casual signed-out player into a returning contributor.

## What's genuinely good (keep)

- **The sign-up value framing.** "Join the PEBL marine monitoring community to submit identifications, track your streak, and contribute to the shared observation record." This is exactly the citizen-science motivation framing the brief asks for — it tells the user *why* an account is worth it, not just that one is required. Keep this verbatim.
- **The consent / age-band design.** The age select + "If you are under 18, a parent or guardian must agree to the Terms... Under-18 accounts are kept off the public leaderboard by default" is careful, honest, and safeguarding-aware. Rare to see done this well. Keep.
- **The account/settings completeness.** Identity, email verification status, notification opt-in, public-leaderboard privacy toggle (with an explicit "Accounts declared as under 18 with this off by default" note), a named **Danger Zone** for deletion, a **GDPR Art. 20 data export** ("Download a JSON file with everything we hold on you"), and a legal block (privacy / terms / accessibility statement). This reads like a credible, lawful product, not a prototype.
- **Forgot-password copy.** "Enter your account email and we'll send you a link to set a new one." Plain, reassuring, correct. Keep.
- **Brand consistency on the auth cards.** Teal eyebrow ("PEBL COMMUNITY ACCESS" / "RESET PASSWORD"), bold dark-navy headings, teal primary button, frosted card on the watery gradient — all on-system.
- **Inline password-strength feedback** on sign-up (the three checks flipping to teal ticks: "at least 8 characters / mixed case (recommended) / includes a number (recommended)"). Good progressive feedback, and the "(recommended)" framing avoids hard-gating the user out.

---

### D-01 — No one-tap / passwordless sign-in option anywhere
- **Screens:** m-signin.png, d-signin.png, m-signup.png, authed-00-signup-filled.png
- **Severity:** P1
- **Lens:** Friction & cognitive load
- **Observation:** Every auth route is an email + password form. Sign-in is email + password; sign-up is email + display name + password + age + terms. There is no "Continue with Google / Apple", no magic-link / email-only option, and no visible divider where such buttons would normally sit. For a public consumer app whose whole goal is converting casual visitors, this is the single heaviest point of friction — a new user must invent and type a password to do anything account-gated.
- **Why it matters:** Citizen-science conversion lives or dies on the sign-up barrier. Password creation is the highest-abandonment step in any consumer funnel; one-tap OAuth or a passwordless magic link routinely lifts completion materially. The app already sends verification + reset emails, so the email infrastructure for magic-link login already exists.
- **Recommendation:** Add at least one one-tap provider ("Continue with Google" is the highest-coverage for the general public) above the email form on both sign-in and sign-up, with an "or" divider. If OAuth is out of scope short-term, add a passwordless **email magic-link** primary path ("Email me a sign-in link") and demote password to a secondary "use a password instead" disclosure. The reveal-before-sign-up flow already lets signed-out users play; this removes the wall they hit at the soft ask.
- **Effort:** L

### D-02 — Sign-in and forgot-password are the forbidden bare card on a blank background
- **Screens:** m-signin.png, d-signin.png, m-forgot-password.png
- **Severity:** P1
- **Lens:** Engagement & motivation
- **Observation:** The brief's design rules explicitly say "auth/empty pages need editorial content in unused viewport — never a bare `max-w-md` card on a blank background." Sign-in and forgot-password are exactly that: a single centred card floating on an empty teal gradient. On desktop (d-signin.png) this is stark — roughly two-thirds of the 1280px-wide viewport is empty water on either side of the card, with no imagery, no species preview, no social proof, no value reinforcement. Sign-up at least carries the community framing inside the card, but it sits on the same empty canvas. The forgot-password page is the emptiest of all — a tiny form in a sea of blank teal.
- **Why it matters:** This wasted space is prime real estate to show what the user is signing up *for* — a looping clip, a species photo strip, a "join 1,200 spotters / 4,300 IDs logged" stat band — which is exactly the social proof and motivation that lifts sign-up intent. A blank canvas reads as unfinished and gives the user nothing to want.
- **Recommendation:** Fill the unused viewport with editorial content: on desktop, a two-column split (form left/right, a looping snippet or species marquee + a live stats band on the other side). On mobile, add a compact strip above or below the card — a single still from a clip, a species silhouette, or a one-line stat ("Spotters have logged 4,312 IDs"). The landing page already has `HeroPreview`, `StatsBand`, and `SpeciesMarquee` components per the project notes; reuse one of them here. For forgot-password, at minimum add a reassuring still or a "you'll be back spotting in a minute" line so it isn't an empty box.
- **Effort:** M

### D-03 — Signed-in menu has no Account / Settings / Sign out — and no path to the account page
- **Screens:** authed-04-menu.png, authed-06-account.png
- **Severity:** P1
- **Lens:** Friction & cognitive load
- **Observation:** The slide-in menu shows the user's display name "UX Review" as plain, non-interactive text at the top, then nav (Live feed / Archive / Species guide / Leaderboard), a "UI sounds" toggle, and a large "LIVE VIDEO" block of playback controls (Video sound, Highlight trace, Playback speed 0.5x/1x/1.5x, Brightness, Contrast). There is **no visible Account / Settings / Profile entry and no Sign out** in the menu. The account-settings page (authed-06-account.png) clearly exists and is rich, but the screenshot of the only obvious navigation surface gives no route to it. The user's name being inert text (not a tappable "View profile / account" row) compounds this — the natural affordance is dead.
- **Why it matters:** Account, settings, and especially **Sign out** are baseline expectations; if they're buried below a long scroll of brightness/contrast sliders or absent entirely, users can't manage or exit their account, which erodes trust and control. On a shared device, no findable sign-out is a real problem. (If these items live further down the menu below the fold, the IA is still wrong — playback tuning should not outrank account/sign-out in the menu order.)
- **Recommendation:** Make the display-name row at the top of the menu a tappable account entry (name + email + chevron → /account), and add an explicit "Account & settings" item plus a "Sign out" item in the top nav group, above or adjacent to the nav links — not below the live-video controls. Demote the per-clip LIVE VIDEO playback controls (brightness/contrast/playback speed) out of the global menu into an in-player controls sheet where they belong contextually; the global menu should be IA (navigation + account), not video tuning.
- **Effort:** M

### D-04 — Verify-email toast obscures the menu and competes with it
- **Screens:** authed-04-menu.png
- **Severity:** P2
- **Lens:** Visual hierarchy & clarity
- **Observation:** A large white "Check your inbox — We have emailed you a link to verify your account. Verify to enable the weekly digest. [Resend email]" toast is anchored at the bottom and overlaps the open dark menu, covering the bottom-left nav and any items that would sit there. Two surfaces (a dark full-height menu and a bright white card) fight for attention in the same frame, and the toast's bright white against the dark menu is visually jarring.
- **Why it matters:** When the primary navigation menu is open, a persistent toast covering its lower portion both hides content (possibly the very Account/Sign-out items from D-03) and splits focus. It also means a returning user opening the menu is greeted by a verification nag every time until they verify.
- **Recommendation:** Suppress transient toasts while the full-screen menu is open (or render them above the menu but not overlapping its scrollable content). For the persistent "verify your email" state, prefer a quiet inline banner inside the account/identity area (which already exists on the account page) plus a small unverified chip, rather than a recurring bottom toast that collides with other surfaces. Ensure the toast auto-dismisses or is dismissible without losing the resend action.
- **Effort:** S

### D-05 — Redundant "(at least 8 characters)" hint plus inline validation states the same rule twice
- **Screens:** m-signin.png, d-signin.png, m-signup.png, authed-00-signup-filled.png
- **Severity:** P2
- **Lens:** Copy & microcopy
- **Observation:** The password label carries "(at least 8 characters)" inline on both sign-in *and* sign-up. On sign-up, the same rule is then restated as the first item in the live checklist below the field ("at least 8 characters"), so the user reads the 8-char rule twice in the same form. On **sign-in**, the "(at least 8 characters)" hint is misplaced entirely — sign-in should not advertise password-composition rules; it only needs the password the user already has, and showing a length rule there reads like a sign-up form and can confuse a returning user into thinking their existing password is being re-validated.
- **Why it matters:** Duplicated/misplaced microcopy adds cognitive load and looks unconsidered. On sign-in it's actively misleading.
- **Recommendation:** Remove "(at least 8 characters)" from the **sign-in** password label entirely (sign-in just needs the field). On **sign-up**, drop the inline "(at least 8 characters)" from the label and rely solely on the live checklist below, OR keep the inline hint and remove the duplicate first checklist item — pick one source of truth, not both.
- **Effort:** S

### D-06 — Low-contrast muted-grey labels in the dark menu fail legibility
- **Screens:** authed-04-menu.png
- **Severity:** P2
- **Lens:** Accessibility (visual)
- **Observation:** In the dark menu, several labels render in a dim grey that sits low against the dark-navy background: the "FISHSPOTTER" wordmark, the "LIVE VIDEO" section eyebrow, and the "Playback speed" / inactive nav glyphs all look faint. The "Archive / Species guide / Leaderboard" link labels are noticeably dimmer than the active "Live feed" row, and the section dividers + muted captions read as washed-out. This is a likely WCAG contrast shortfall for the small eyebrow text in particular.
- **Why it matters:** Low-contrast labels on the primary navigation hurt scannability for all users and fail accessibility for low-vision users — and the brief grades accessibility explicitly. Navigation is the one surface that must be effortlessly legible.
- **Recommendation:** Lift the inactive nav-label and section-eyebrow colour to meet at least 4.5:1 against the dark menu background (use a lighter teal-tinted off-white rather than mid-grey). Keep the active-row teal accent for state, but ensure inactive items are clearly readable, not greyed to near-disabled appearance.
- **Effort:** S

### D-07 — "Save" button on the display-name field is small, low-contrast, and easy to miss
- **Screens:** authed-06-account.png
- **Severity:** P2
- **Lens:** Visual hierarchy & clarity
- **Observation:** In the IDENTITY/DISPLAY NAME section the "Save" button is a small, pale/washed teal pill tucked to the right of the input — it reads as semi-disabled and visually subordinate to the input. Its hit area also looks below the 44x44px mobile touch-target minimum the design rules require. There's no visible indication of whether it's enabled only on change vs always tappable.
- **Why it matters:** The one editable field a user is most likely to change (their public display name, which shows on the leaderboard) has a weak, possibly under-sized affordance, so saving a rename feels uncertain. Sub-44px targets fail the brief's mobile rule.
- **Recommendation:** Give the Save control a solid primary-teal fill at full opacity once the field is dirty, ensure a >=44px tap height, and add a brief confirmation (e.g. a "Saved" tick) on success. Consider save-on-blur as a fallback so the user isn't reliant on hitting a small button. Disable + grey it only when the field is unchanged, with a clear enabled state on edit.
- **Effort:** S

### D-08 — Sign-up form length and "spotting profile" framing add perceived friction at the soft ask
- **Screens:** m-signup.png, authed-00-signup-filled.png
- **Severity:** P2
- **Lens:** Friction & cognitive load
- **Observation:** The sign-up form is five distinct decisions stacked vertically: email, display name, password (with a 3-item checklist), age select, and a terms checkbox — plus the under-18 explainer paragraph. On a single mobile viewport that's a tall, form-heavy first impression. The heading "Create your spotting profile" sets the expectation of a profile-building step, but no avatar/bio/interests are collected, so "profile" slightly oversells what is really a standard account sign-up.
- **Why it matters:** Coming off a reveal where the user just had fun spotting, a five-field gate is a register shift from play to paperwork. The more fields visible at once, the higher the bounce. Display name in particular could be deferred (auto-generate a spotter handle, let them rename later on the account page they already have).
- **Recommendation:** Trim the *visible* first step: keep email + password + age + terms (the legally/operationally required set), and **defer display name** — auto-assign a friendly default ("Spotter 4312") that the account page already lets them edit, or collect it post-sign-up on first leaderboard entry. Keep the heading honest ("Create your account") unless real profile fields are added. Pair this with D-01 (one-tap) so the fastest path is genuinely one or two taps.
- **Effort:** M

### D-09 — Required-field asterisks are inconsistent and unexplained across the auth set
- **Screens:** m-signin.png, m-signup.png, authed-00-signup-filled.png, m-forgot-password.png
- **Severity:** P3
- **Lens:** Consistency
- **Observation:** Sign-in and sign-up mark Email and Password with a red `*`, but there's no "* required" legend, and on sign-up the *Display name* and *Age* and *terms checkbox* are also effectively required yet don't all carry the same asterisk treatment (display name shows an asterisk; the terms checkbox and age use prose/structure instead). Forgot-password's Email has no asterisk at all. The required-marking convention is applied unevenly across the four screens.
- **Why it matters:** Inconsistent required-field signalling is a small polish/trust tell and can leave users unsure which fields are mandatory, especially when one truly-required control (terms) isn't asterisked while a less-critical one is.
- **Recommendation:** Standardise: either asterisk every required field consistently (and add a single "* required" note once) or drop asterisks entirely and rely on inline validation. Apply the same rule across sign-in, sign-up, and forgot-password. Given most fields are required, dropping the asterisks and validating on submit is the lower-noise option.
- **Effort:** S

### D-10 — "Danger Zone" heading uses a non-palette red; deletion lacks a confirmation affordance in view
- **Screens:** authed-06-account.png
- **Severity:** P3
- **Lens:** Consistency
- **Observation:** The "DANGER ZONE" eyebrow and the "Delete account" button outline render in a red that is outside the documented PEBL palette (navy/teal/dark-teal/light-teal/white) and isn't one of the named semantic tokens (correct/incorrect/pending). The copy correctly warns "This is immediate and cannot be undone," but the button appears to be a single-step outline button with no visible secondary confirmation step (e.g. type-to-confirm) on this surface.
- **Why it matters:** Off-palette red is a minor consistency drift, but account deletion being "immediate" while presented as a one-tap outline button is a genuine destructive-action risk — an accidental tap could irrecoverably delete the account and all answers.
- **Recommendation:** Use a defined semantic "destructive" token (add one to the palette if absent — a controlled red that harmonises with the brand) rather than ad-hoc red. Gate deletion behind an explicit confirm step (modal with "type DELETE" or a two-tap confirm), so "immediate and cannot be undone" is matched by a deliberate confirmation, not a single outline tap.
- **Effort:** S

### D-11 — Forgot-password is a dead-end on success risk; no inline state shown, and "Email" lacks the helper consistency of the other forms
- **Screens:** m-forgot-password.png
- **Severity:** P3
- **Lens:** First-time comprehension
- **Observation:** The forgot-password screen is minimal (Email field, "Send reset link", "Back to sign in"). The Email field here has no `*` and no helper, unlike sign-in/sign-up where email is asterisked — a small inconsistency. More importantly, there's no visible indication of what the success state looks like; on a single-field flow it's worth confirming the user isn't left wondering whether the link sent (this can't be fully judged from one static shot, flagged as a risk).
- **Why it matters:** Password reset is a stress moment (the user is locked out). Any ambiguity about whether the link was sent increases anxiety and repeat submissions.
- **Recommendation:** Ensure a clear post-submit confirmation state ("If an account exists for that email, we've sent a reset link — check your inbox") replacing the form, with a resend option. Align the Email field's required-marking with the rest of the auth set (per D-09). Optionally add the same light editorial backdrop fix from D-02 so it isn't a bare box.
- **Effort:** S

---

## Returned summary

- **Prefix:** D
- **Counts:** 0 P0, 3 P1, 5 P2, 3 P3 (11 findings)
- **Verdict:** The auth and account surfaces are clean, on-brand, and unusually thoughtful on copy and the legal/consent layer (age band, under-18 safeguarding, GDPR data export, a real danger zone) — a genuinely trustworthy account page. The weaknesses cluster in three places that matter for the conversion goal: (1) friction — every route is a password form with no one-tap or passwordless option, and sign-up is a five-field gate at the soft ask; (2) the blank-canvas problem — sign-in and forgot-password are the exact bare `max-w-md` card on empty teal the design rules forbid, wasting prime motivation real estate (especially on desktop); and (3) an IA hole in the signed-in menu, which surfaces a wall of live-video playback sliders but no visible Account, Settings, or Sign out, with the user's name sitting as inert text. Smaller polish items (low-contrast dark-menu labels, a weak Save affordance, duplicated 8-char hint, off-palette danger-zone red) round out the list. Fix the one-tap/passwordless path and the menu account/sign-out gap first; they unblock retention most directly.
