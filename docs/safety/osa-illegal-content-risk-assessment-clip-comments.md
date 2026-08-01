# Illegal content risk assessment — clip comments feature

**Service:** FishSpotter (fish-spotter.vercel.app), operated by PEBL CIC
**Feature assessed:** public per-clip discussion threads (`/api/comments`, `/admin/comments`), introduced 2026-08-01
**Prepared by:** Claude (engineering analysis), Christian Berger (PEBL CIC)
**Status:** WORKING DRAFT prepared by engineering, based on the actual implementation.
**This is not a substitute for formal legal/compliance sign-off.** It records
the technical facts, the risks they create, and the mitigations already
built, so a human accountable for OSA compliance can review, amend, and
formally adopt it. Treat every risk rating below as a starting proposal, not
a determination.
**Review cadence:** re-assess on any material change to the comments feature
(new posting surface, moderation change, or a real incident), and at least
annually.

---

## 1. Duty this responds to

Online Safety Act 2023, s.10 (user-to-user services): a duty to assess the
risk of the service facilitating priority illegal content and other illegal
content, and to take proportionate measures to mitigate and manage that risk.

## 2. Service description

FishSpotter is a citizen-science web app: users watch short underwater video
clips from PEBL's UK marine surveys and submit species identifications. Prior
to this feature, the only user-to-user surface was an anonymous aggregate
histogram of guesses (no free text, no user-to-user visibility).

**What changed:** a spotter can now leave a free-text comment on a clip after
submitting their own identification. Comments form a public thread, readable
by any spotter who has answered that clip, with one level of reply nesting.

## 3. User base

- Self-declared age bands at signup: under-13 (blocked outright), 13-17, 18+.
  Age is **self-declared only** — there is no age-verification or
  age-estimation step. This is a material limitation, not a mitigation; see
  §7.
- The service is UK-facing (PEBL CIC survey data, UK species, UK audience),
  but has no geographic access restriction.
- No account is required to *read* the feed or the pre-answer histogram;
  an account is required to answer, and (new) to post or read comments
  (see §5, gate 1).

## 4. Functionalities that create risk

| Functionality | Risk it introduces |
|---|---|
| Free-text comment body (up to 500 characters) | Vector for any priority illegal content category expressible in text |
| Reply to another user's comment | Direct user-to-user address, raising harassment/targeting risk specifically |
| Public visibility (to any spotter who has answered the clip) | Content can reach an unbounded audience of app users, not just the two parties |
| Suggested-species free-text field | A secondary, smaller free-text surface with the same content risk, currently covered by the same body-sanitisation and blocklist path |

## 5. Risk-by-category assessment

For each OSA priority category, the columns are: whether the functionality
above realistically enables it on this service, the mitigations already
built, and a residual risk rating (Low / Medium / High) *given those
mitigations*, proposed by engineering for review.

### 5.1 Child sexual exploitation and abuse (CSEA)

- **Enabled by:** free-text comment body, in principle.
- **Mitigations:** the merged word-level blocklist (`src/lib/comments.ts`,
  sourced 2026-08-01 from the LDNOOBW open-source list — see the file's doc
  comment for full provenance) includes CSEA-related terms (grooming/abuse
  slang, `pedophile`, `pedobear`, `jailbait`, `nambla`, `pthc`, `shota`,
  `lolita`) and holds a matching comment for staff review rather than
  publishing it. The Report control on every comment is a second, independent
  path. No private messaging exists on the service at all — a structural
  mitigation, not just a policy one: there is no mechanism on FishSpotter for
  one user to contact another privately, exchange contact details in a
  DM-like channel, or arrange contact outside the public, moderated thread.
- **Residual risk: Low.** The absence of private messaging is the single
  strongest mitigation here — the highest-severity CSEA risk pattern
  (grooming via private contact) has no channel to occur through on this
  service. Public-thread CSEA content is caught by the blocklist hold or
  reactive report, both landing in a staff-monitored inbox with instant
  email notification (§6).

### 5.2 Terrorism

- **Enabled by:** free-text comment body, in principle.
- **Mitigations:** general moderation (report, admin removal, account
  suspension already in the Terms of Service). No terrorism-specific
  keyword coverage in the blocklist (out of scope for a general profanity
  list; terrorism content moderation typically needs a specialist
  classifier, not a wordlist).
- **Residual risk: Low.** The subject matter (marine species identification)
  and audience (citizen-science hobbyists) give essentially no organic
  pathway to this content, and the report/removal path is a real backstop if
  it somehow appeared.

### 5.3 Hate offences / racially or religiously aggravated harassment

- **Enabled by:** free-text comment body and reply (direct address).
- **Mitigations:** the sourced blocklist directly targets this category —
  it includes commonly-used English-language ethnic, racial, and homophobic
  slurs (holds for review rather than rejecting, so a false positive doesn't
  silently lose a legitimate contribution). Report reasons include "abusive".
  Auto-hide at 3 distinct reporters. Admin can hide, delete, or suspend the
  account (existing Terms "Acceptable use" section already covers this).
- **Residual risk: Medium.** This is the category the blocklist is weakest
  against in absolute terms: it is a general-purpose open-source list, not a
  continuously-maintained, comprehensive hate-speech lexicon, and it has zero
  evasion resistance (spaced letters, leetspeak, coded terms bypass it
  entirely — a deliberate design trade-off, see the blocklist's doc comment).
  The reactive report path is the real backstop for anything the wordlist
  misses, and it is a strong one (one report from the target plus two more
  auto-hides pending review), but it is reactive, not preventive — content is
  visible until reported. **Recommended follow-up:** evaluate a maintained
  moderation API (e.g. a hate-speech/toxicity classifier) as a
  pre-publication check; this needs a vendor and cost decision (Christian's
  call), not something built silently into this pass.

### 5.4 Harassment, stalking, and controlling or coercive behaviour

- **Enabled by:** reply (direct address to a named user), comment visibility
  tied to a real display name (see §7 on the anonymisation mitigation).
- **Mitigations:** Report reason "abusive"/"personal-info". The privacy
  clauses (Terms "Comments and discussion", added with this feature)
  explicitly prohibit posting personal information about yourself or anyone
  else. No way to see another user's email or any contact detail through the
  comment surface — `authorId` links only to the public `/u/[id]` profile,
  which shows aggregate spotting stats, not personal data.
- **Residual risk: Low-Medium.** A single reply thread with a small number
  of participants (typically two: the original commenter and repliers) means
  a determined harasser could still direct hostile replies at one person
  within that thread before a report resolves. Rate limiting (20
  comments/hour/user) caps volume but not a handful of hostile replies in one
  sitting.

### 5.5 Fraud and financial harm

- **Enabled by:** free-text comment body could in principle carry a scam
  link or solicitation.
- **Mitigations:** **all links are rejected outright at post time**
  (`containsUrl()` — `http://`, `https://`, `www.`, and bare domain patterns
  including `.co.uk`), not merely held for review. This is a hard block, the
  strongest mitigation in the whole feature, because the majority of fraud
  vectors in a comment box depend on a clickable link or a reachable domain.
- **Residual risk: Low.** Text-only solicitation without a link ("DM me on
  [platform]") is not blocked, but the service has no DM feature to direct
  anyone to, and the audience/context (marine species ID) gives little
  organic pathway to fraud content.

### 5.6 Drugs and psychoactive substances / weapons

- **Enabled by:** free-text comment body, in principle.
- **Mitigations:** general moderation only; no keyword coverage (out of
  scope for a marine-species app's blocklist).
- **Residual risk: Low.** No organic pathway from the subject matter or
  audience; report/removal is the backstop.

## 6. Cross-cutting mitigations (apply to every category above)

| Mitigation | What it does |
|---|---|
| **Anti-herding gate** (`GET /api/comments`, INV-1) | A reader must have submitted their own species ID on that clip before the thread is visible at all. This bounds the *reachable audience* of any single piece of illegal content to spotters who have engaged with that specific clip, not the whole user base. |
| **No private messaging anywhere on the service** | Removes the highest-severity contact/grooming vector structurally, not by policy. |
| **Link rejection** | Hard block on all URLs at post time (§5.5). |
| **Blocklist hold** | A match holds the comment (`hiddenAt` set at creation, `hiddenReason` recorded) instead of publishing it; visible only to its author and staff pending review. |
| **Report control** | On every comment, five reason categories, one report per person per comment (can't be inflated by one user). |
| **Auto-hide at 3 reports** | Hides pending review without requiring an admin to be online at the moment of report. |
| **Instant staff email** | A new comment, a reply to a PEBL comment, or the first report of any comment triggers an email to every verified `@pebl-cic.co.uk` account within the request (throttled per recipient to prevent the channel becoming unusable under load). |
| **Admin removal + account suspension** | Already covered by the Terms of Service "Acceptable use" section (applies service-wide, not just to comments). |
| **Rate limiting** | 20 comments/hour/user, capped at 3 top-level comments per clip (replies exempt from the per-clip cap so a conversation isn't cut off). |
| **`adminNote` and moderation metadata never reach a client** | `toPublicComment()` (single serialisation door, unit- and mutation-tested) — irrelevant to illegal-content risk directly, but ensures the moderation record itself cannot leak. |

## 7. Known limitations (recorded, not hidden)

- **No age verification.** Age is self-declared at signup with no
  verification or estimation step. A user who lies about their age is
  treated as their declared band. This is a limitation of the account system
  as a whole, not specific to comments, but it means every "13-17" mitigation
  in the children's risk assessment relies on honest self-declaration.
- **Blocklist has no evasion resistance.** Spaced-out or leetspeak variants
  of a blocked word are not caught. Deliberate trade-off (see the blocklist's
  doc comment): an arms race in a regex was judged not worth the complexity
  versus the reactive report path.
- **Blocklist is not a comprehensive hate-speech lexicon.** It is a
  general-purpose open-source list (LDNOOBW), not a specialist, continuously
  updated one. See §5.3's recommended follow-up.
- **Moderation is largely reactive, not preventive**, outside the blocklist
  hold and link rejection. Content is live and publicly visible from the
  moment it's posted (to spotters who've answered that clip) until a report
  or staff action removes it.

## 8. Overall proposed rating and recommended actions

**Proposed overall residual risk: Low-Medium**, driven mainly by §5.3 (hate
offences) and §5.4 (harassment), both real but bounded by the anti-herding
audience gate, the absence of any private-messaging channel, and a working
reactive-report pipeline with instant staff notification.

**Recommended actions, in priority order:**
1. Formal review and sign-off of this document by Christian / PEBL's
   accountable person before the feature is publicly live.
2. Evaluate a maintained hate-speech/toxicity moderation API as a
   pre-publication check (§5.3) — vendor and cost decision required.
3. Monitor `/admin/comments` report volume and categories for the first
   weeks post-launch; use that real data to revisit this assessment's
   ratings rather than relying solely on this pre-launch analysis.
4. Re-run this assessment if a real incident occurs, or on any material
   change to the feature.
