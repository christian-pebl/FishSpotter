# FishSpotter Next.js App — Accessibility Audit Report

**Date:** 2026-05-14

---

## 1. Semantic HTML & Landmarks

**Issue 1: Heading hierarchy skip in home page**
- **Severity:** MODERATE
- **File/Line:** `src/app/page.tsx:37, 44, 51`
- **Finding:** Three h2 elements in feature cards lack parent h2 section heading above them.
- **Recommendation:** Add h2 "How FishSpotter Works" heading above the three cards.

**Issue 2: Leaderboard uses list instead of table**
- **Severity:** SERIOUS
- **File/Line:** `src/app/leaderboard/page.tsx:42`
- **Finding:** Leaderboard rank/name/score/accuracy rendered as `<ul><li>` instead of `<table>`. Screen readers won't understand column relationships.
- **Recommendation:** Convert to `<table>` with `<thead>`, `<tbody>`, `<th>` elements.

**Issue 3: Feed page FeedPlayer not in main landmark**
- **Severity:** MODERATE
- **File/Line:** `src/app/feed/page.tsx:47`
- **Finding:** FeedPlayer component not explicitly wrapped in `<main>` tag.
- **Recommendation:** Wrap FeedPlayer in `<main>` or restructure.

---

## 2. Images & Alt Text

**Issue 4: Thumbnail alt text unclear**
- **Severity:** MINOR
- **File/Line:** `src/app/feed/browse/page.tsx:41`
- **Finding:** Thumbnail `<Image>` has `alt=""`. If informative, should describe creature.
- **Recommendation:** Verify if informative and update alt text accordingly.

---

## 3. Icon Buttons

**Issue 5: Streak counter missing aria-label**
- **Severity:** MINOR
- **File/Line:** `src/components/Header.tsx:84-95`
- **Finding:** Streak span has `title` but no `aria-label` for screen readers.
- **Recommendation:** Add `aria-label="Current streak: {streak} days"`.

---

## 4. Form Accessibility

**Issue 6: Error messages not linked with aria-describedby**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:326`, `src/components/SnippetPlayer.tsx:127`, `src/app/auth/signin/page.tsx:94`
- **Finding:** Error `<p>` elements displayed below inputs but not associated via `aria-describedby`.
- **Recommendation:** Add `aria-describedby="error-{id}"` to inputs.

**Issue 7: Auth form missing required field indicators**
- **Severity:** MODERATE
- **File/Line:** `src/app/auth/signin/page.tsx:58-65`
- **Finding:** Email input `required` but no `aria-required="true"` or visual indicator.
- **Recommendation:** Add `aria-required="true"` and mark with "*" or bold.

**Issue 8: Auth inputs missing autocomplete**
- **Severity:** MINOR
- **File/Line:** `src/app/auth/signin/page.tsx:58-92`
- **Finding:** No `autocomplete` attributes on email/password/name inputs.
- **Recommendation:** Add `autocomplete="email"`, `autocomplete="current-password"`, etc.

---

## 5. Video & Media

**Issue 9: Missing video captions**
- **Severity:** CRITICAL
- **File/Line:** `src/components/FeedCard.tsx:217-226`, `src/components/SnippetPlayer.tsx:42-48`
- **Finding:** No `<track>` elements for captions. Deaf/hard-of-hearing users cannot access video.
- **Recommendation:** Add caption tracks and integrate caption generation into pipeline.

**Issue 10: Video not keyboard-accessible in feed**
- **Severity:** SERIOUS
- **File/Line:** `src/components/FeedCard.tsx:217-226`
- **Finding:** Feed video auto-plays based on scroll; no visible controls or keyboard shortcuts (Space, arrows).
- **Recommendation:** Add visible controls or keyboard handlers.

---

## 6. Motion & prefers-reduced-motion

**Issue 11: No prefers-reduced-motion support**
- **Severity:** SERIOUS
- **File/Line:** `src/lib/confetti.ts`, `src/components/FeedCard.tsx:88`, `src/components/Header.tsx:88`, `src/components/FeedPlayer.tsx:133`
- **Finding:** Confetti and Framer Motion animations do not check for `prefers-reduced-motion: reduce`.
- **Recommendation:** Add `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;` to confetti; create useReducedMotion hook.

---

## 7. Keyboard Navigation

**Issue 12: Suggestion modal no escape key handling**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:293-324`, `src/components/SnippetPlayer.tsx:94-125`
- **Finding:** Correction suggestion cannot be closed with Escape key.
- **Recommendation:** Add `onKeyDown` to close on Escape.

**Issue 13: Feed navigation no keyboard hint**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedPlayer.tsx:122-143`
- **Finding:** Navigation hint shows "Scroll for next" but no keyboard equivalent (arrows, Page Down) indicated or implemented.
- **Recommendation:** Display keyboard shortcut and implement ArrowUp/ArrowDown handlers.

**Issue 14: Suggestion modal lacks focus management**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:293-324`
- **Finding:** When suggestion appears, focus stays on hidden input; no autoFocus on button or focus trap.
- **Recommendation:** Set autoFocus on "Yes, use that" button and implement focus trap.

---

## 8. Color Contrast

**Issue 15: Disabled button opacity insufficient**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:334`, `src/components/SnippetPlayer.tsx:137`
- **Finding:** `disabled:opacity-50` may not meet WCAG AA; teal at 50% opacity could be ~3:1 or lower.
- **Recommendation:** Use distinct disabled color (e.g., gray) instead of just opacity.

---

## 9. Page Metadata

**Issue 16: Individual page titles not customized**
- **Severity:** MINOR
- **File/Line:** `src/app/feed/page.tsx`, `src/app/feed/[id]/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/auth/signin/page.tsx`
- **Finding:** All pages default to "PEBL FishSpotter"; users don't know which page they're on.
- **Recommendation:** Export metadata for each route with descriptive titles.

---

## 10. ARIA & Live Regions

**Issue 17: Streak not announced as live region**
- **Severity:** MODERATE
- **File/Line:** `src/components/Header.tsx:84-95`
- **Finding:** Streak updates dynamically but no `aria-live="polite"` or `aria-atomic="true"`.
- **Recommendation:** Add both attributes to announce updates.

**Issue 18: Submission state not announced**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:336-340`, `src/components/SnippetPlayer.tsx:139`
- **Finding:** Button text changes "Confirm" → "Submitting…" but no `aria-busy` or aria-label update.
- **Recommendation:** Add `aria-busy="true"` when submitting.

**Issue 19: Stats section hierarchy unclear**
- **Severity:** MODERATE
- **File/Line:** `src/components/FeedCard.tsx:380`, `src/components/SnippetPlayer.tsx:179`
- **Finding:** "Community response" not hierarchically linked to main h2.
- **Recommendation:** Make it h3/h4 and ensure proper nesting.

---

## 11. Miscellaneous

**Issue 20: No skip-to-main-content link**
- **Severity:** MINOR
- **File/Line:** `src/app/layout.tsx`
- **Finding:** Keyboard/screen reader users cannot skip past header navigation.
- **Recommendation:** Add `<a href="#main" className="sr-only">Skip to main content</a>` and `id="main"` to main content div.

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 1 | Issue 9 |
| SERIOUS  | 3 | Issues 2, 10, 11 |
| MODERATE | 11 | Issues 1, 3, 6, 7, 12, 13, 14, 15, 17, 18, 19 |
| MINOR    | 5 | Issues 4, 5, 8, 16, 20 |

**Total: 20 findings**

---

## Priority

1. **Immediate:** Issues 9, 11, 2, 10
2. **High:** Issues 6, 1, 17, 14
3. **Medium:** Issues 3, 7, 12, 13, 16, 18, 19
4. **Low:** Issues 4, 5, 8, 15, 20
