# Children's risk assessment: clip comments feature

**Service:** FishSpotter (fish-spotter.vercel.app), operated by PEBL CIC
**Feature assessed:** public per-clip discussion threads, introduced 2026-08-01
**Prepared by:** Claude (engineering analysis), from the actual implementation.
**Reviewed and adopted by:** Christian Berger, PEBL CIC, **2026-08-01**.

**Status: ADOPTED 2026-08-01**, including the explicit age-segregation decision
recorded in §4.2 and §6. **A review dated 2026-09-16 (§7) records a significant
change and is awaiting re-adoption.**

**Provenance note, retained deliberately:** drafted by an AI assistant
analysing the codebase, then reviewed and adopted by PEBL's accountable
person. That is an honest description of how it was produced and should not
be edited out. It is the service provider's own assessment, not independent
legal advice.

Companion document: `osa-illegal-content-risk-assessment-clip-comments.md`
(read that one first for the base risk analysis; this document covers what
is *additional or different* for child users).

**Review cadence:** re-assess on any material change to the comments
feature, on any material change to who can access it, and at least annually.
Next scheduled review: **2027-08-01**.

---

## 1. Duty this responds to

Online Safety Act 2023, s.12: services likely to be accessed by children have
an additional duty to assess risks to children specifically, separate from
the general illegal-content assessment. FishSpotter self-declares as
accessible to 13-17 year olds (signup permits that band; under-13 is blocked
outright), so this duty applies.

This document also cross-references the **ICO Age Appropriate Design Code
(Children's Code)**, since PEBL already has design commitments under it (the
`ageBracket` self-declaration and the `leaderboardOptIn` default are both
existing Children's Code responses, predating this feature), the comments
feature needed to either extend those commitments or justify a deliberate
departure. §5 records which.

## 2. Is the service likely to be accessed by children?

Yes, by design: 13-17 is an explicit, offered signup option
(`src/lib/auth.ts`), not a possibility the service merely fails to prevent.
Under-13 signup is blocked outright at the credentials-provider level. There
is no age verification beyond self-declaration (see the base assessment §7)
- a limitation that applies here too: a user under 13 who declares 13-17
would be treated as a minor, not detected as under the platform's minimum
age.

## 3. What changed for child users specifically

Before this feature, a signed-in minor's only user-to-user exposure was an
anonymous aggregate histogram (no free text, no identity attached). The
comments feature is the **first user-to-user, identity-attached, free-text
surface** a minor on this service can be exposed to, both as a reader and as
a poster.

## 4. Risks to children, and what is different from the adult case

### 4.1 Exposure to harmful or age-inappropriate content

- Covered in the base illegal-content assessment (§5 there). Nothing in the
  comments feature differentiates content shown to a 13-17 account from
  content shown to an 18+ account, the thread is not age-gated by content
  rating, only by the anti-herding answer-gate (same for everyone).
- **This is a gap worth naming plainly**: there is no additional content
  filtering or a stricter blocklist threshold for declared minors. The
  mitigations in the base assessment (blocklist hold, link rejection, report,
  auto-hide) are the only protection a 13-17 account has, identical to an
  18+ account's. Given the subject matter (marine species ID) and the
  absence of private messaging, the practical exposure risk is judged low in
  the base assessment, but that judgement was not made *specifically*
  stronger or weaker for minors, it is the same analysis applied uniformly.

### 4.2 Contact and grooming risk

- As in the base assessment §5.1: **no private messaging exists anywhere on
  the service.** This is the strongest available mitigation for the
  highest-severity children's-safety risk (an adult using the platform to
  initiate private contact with a minor), and it applies with equal force
  here, there is no channel through which such contact could begin.
- Every comment is visible to any spotter who has answered that clip
  (adults and minors on the platform are not separated into different
  visibility groups), an adult and a minor CAN see and reply to each
  other's comments in the same public thread. This is a real, un-mitigated
  fact worth recording rather than a residual risk this assessment can talk
  down: the design does not attempt age-segregated threads, and doing so
  would require reliable age verification the platform does not have.
  **DECIDED 2026-08-01 (Christian Berger, PEBL CIC): age-segregated comment
  visibility will NOT be built at this time.** This is a deliberate, recorded
  decision, not an oversight or a default. The reasoning adopted:
  - Meaningful age segregation depends on knowing who is actually a child.
    FishSpotter has **self-declared age bands only**, with no verification or
    estimation, so any segregation built on that signal would protect only
    users who declared honestly, precisely the users least likely to be at
    risk from a bad actor, who would simply declare 18+.
  - It would therefore add real complexity and a false sense of protection
    without meaningfully reducing the risk it purports to address.
  - The mitigations that *do* work regardless of declared age are already in
    place and are structural rather than declarative: no private messaging
    anywhere on the service (removing the highest-severity contact vector
    entirely), the answer-gate bounding each thread's reachable audience,
    public-only visibility so nothing happens out of sight of other users and
    staff, and a reactive report pipeline with instant staff notification.
  - The service's actual profile (a citizen-science species-ID tool, not a
    social platform; threads are short, topical, and about marine wildlife)
    makes sustained peer-to-peer interaction between strangers an unlikely
    usage pattern in the first place.

  **This decision is revisited if any of the following change:** real age
  verification is added; comment usage shifts toward sustained social
  interaction rather than species discussion; or any incident involving a
  declared-minor account occurs.

### 4.3 Identity exposure (the anonymisation fix, 2026-08-01)

- **This is the concrete inconsistency this pass closed.** Before this fix,
  a declared minor's real display name, already hidden from the public
  leaderboard by the existing `leaderboardOptIn: false` default for 13-17
  signups (`src/lib/auth.ts`), would still have been shown publicly on
  every comment they posted, undoing that existing protection the moment
  they used the new feature.
- **Fix, live in this build:** `publicAuthorName()` (`src/lib/comments.ts`)
  extends the same `leaderboardOptIn` signal to public comment display. An
  opted-out author (which includes every self-declared minor by default,
  unless they later opt back in via account settings) is shown to *other*
  spotters under an anonymised handle (`Spotter <id6>`, the same format
  already used as the null-display-name fallback elsewhere in the app, so
  it carries no separate "anonymous" stigma). The author still sees their
  own real name on their own comment; PEBL staff can still see the real name
  for moderation (a distinct legal basis, operating and moderating the
  service, from the public-display protection this gates).
- This directly implements the Children's Code's "high privacy by default"
  principle for a new surface, consistent with the precedent the app already
  set for the leaderboard, rather than leaving a silent gap. Verified with
  unit tests (`comments.test.ts`, "publicAuthorName / isAnonymised") and a
  leak-guard test confirming the real name never appears in the serialised
  payload for a non-owner, non-admin viewer.

### 4.4 Bullying, harassment, and peer conflict between minors

- Covered generally in the base assessment §5.4. Nothing minor-specific
  changes the mechanism, but the *impact* of unaddressed peer harassment is
  typically judged more severe for a 13-17 user than an adult, which is why
  it is called out here as a distinct consideration rather than assumed
  covered by the general analysis.
- Mitigations available equally: Report control, one report per person
  per comment, auto-hide at 3 reports, admin removal, account suspension.

### 4.5 Encouraging harmful behaviour (self-harm, dangerous challenges, etc.)

- No pathway from the service's actual content (marine species
  identification clips) or realistic comment content to this category. No
  specific mitigation beyond general moderation; judged appropriately low
  risk given the subject matter, not because of a targeted control.

### 4.6 Commercial/data exploitation specific to children

- No advertising, no third-party trackers, no behavioural profiling on the
  comments feature (consistent with the rest of the app, see the Privacy
  Policy's existing consent-gated, minimal-collection analytics model).
  Comment data collection is limited to what operating the public thread and
  moderating it requires (Privacy Policy, "Comments you post" row, updated
  with this feature).

## 5. Children's Code (ICO AADC) cross-reference

| AADC standard | How this feature responds |
|---|---|
| Best interests of the child | Anonymisation fix (§4.3) extends an existing protection to a new surface rather than leaving it inconsistent. |
| High privacy by default | Anonymisation fix (§4.3); no additional data collected beyond what operating/moderating the thread needs. |
| Age-appropriate application | **Not differentiated by age within 13-17 vs 18+** for content exposure (§4.1), a named gap, not a claimed mitigation. |
| Transparency | Terms of Service "Comments and discussion" section and Privacy Policy updates (both shipped with this feature) describe the public nature of comments, moderation, and the anonymisation behaviour in plain language. |
| Detrimental use of data | No profiling, no nudge techniques, no engagement-maximising design specific to comments (no notification badges pushing a minor back to reply, no streak mechanic tied to commenting). |

## 6. Overall proposed rating and recommended actions

**Proposed overall residual risk to children: Medium**, higher than the base
illegal-content assessment's Low-Medium, specifically because of §4.2 (adults
and minors share the same public thread with no age segregation) and §4.1
(no minor-specific content filtering beyond the uniform mitigations). Neither
is a defect introduced by this feature carelessly, both are genuine,
named trade-offs given the platform has no reliable age verification to
build stricter controls on top of, but they should be weighed by whoever
signs this off, not smoothed over.

**Actions:**
1. ~~Formal review and sign-off, with explicit attention to §4.2.~~
   **DONE 2026-08-01**, adopted by Christian Berger, with the §4.2
   age-segregation trade-off explicitly considered and decided.
2. ~~Decide whether age-segregated comment visibility is worth building.~~
   **DECIDED 2026-08-01: no.** Full reasoning recorded in §4.2. The Medium
   rating above is therefore an *accepted* residual risk, consciously taken
   with the mitigations in §4.2 judged proportionate to the service's actual
   profile, not an unresolved gap.
3. **OPEN, ongoing**, monitor whether any reports on `/admin/comments`
   involve a declared-minor account, either as reporter or subject, once real
   usage data exists. This is the strongest signal for revisiting these
   ratings, and the trigger most likely to reopen the §4.2 decision.
4. **STANDING**, re-run this assessment if age verification is ever added
   (it would materially change what mitigations are feasible), if usage
   shifts toward sustained social interaction, or if a real incident
   involving a minor occurs.

---

## 7. Review, 2026-09-16: children under 13 are users

**Status of this review: prepared 2026-09-16, awaiting re-adoption by the accountable person.** The Act requires this assessment to be revisited before a significant change to the service (s11(4)); the change below is one.

### 7.1 What changed in the facts

Section 2 said under-13 signup was "blocked outright". That was true of full signup only. Guest mode, added 16-17 July 2026, never asked an age, and on 2026-09-16 ten guests who had saved their progress were found to use US school email addresses, one of them a pre-K to 8th grade school. **Children, very likely including under-13s, use the service.** The child user condition (s35) is met on the facts, not just by design.

### 7.2 What changed in the service

- Every player is asked their age group: guests before they pick a name, signups on the form, and every older account once. Unknown age is treated as possibly a child.
- Under-13s can play with a generated nickname, **cannot post comments**, are never named publicly, and never give their own email. A parent's emailed consent keeps their account or unlocks a prize (`docs/compliance/children.md`).
- Declared 13 to 17 year olds keep the protections in section 4 (anonymised comment name by default, private leaderboard by default).
- Accounts that have not given an age cannot post comments and are never named publicly.
- Public naming (leaderboard, profile pages, comment names) now needs a declared age of 13 or over **and** the setting switched on. Profile pages of anyone else return "not found" to other users, which closes a gap: a comment's author id could be used to reach a minor's profile page and see their chosen name.

### 7.3 Effect on the risks in section 4

| Risk | Change |
|---|---|
| 4.1 Exposure to harmful content | Under-13s can still **read** threads on clips they have answered. Exposure is unchanged in kind; moderation, link blocking, reporting and auto-hide apply. Keep under review; the simplest further step would be hiding threads from under-13s. |
| 4.2 Contact and grooming | Under-13s cannot post or reply, so there is no way to start or answer a conversation with them. No private messaging exists. **Reduced for under-13s.** |
| 4.3 Identity exposure | Under-13s have generated names and are never named publicly; unasked accounts are anonymised. **Reduced.** |
| 4.4 Bullying | Under-13s cannot be addressed by name, and cannot post. Unchanged for 13 to 17. |
| 4.6 Commercial and data exploitation | No optional emails to under-13s, no streak reminders to under-18s, no analytics for under-13s, no AI chat for under-18s. **Reduced.** |

**Proposed overall residual risk to children: Medium for 13 to 17 year olds (unchanged, for the reasons in section 6), Low for under-13s.**

### 7.4 Actions

1. Re-adopt this assessment, with the 7.2 changes, before or when they go live.
2. Decide whether under-13s should also be unable to **read** comment threads (a one-line change in `GET /api/comments`).
3. Watch `/admin/comments` and `/admin/children` for any report involving a young account.
4. Next review: 2027-08-01, or sooner on any incident.
