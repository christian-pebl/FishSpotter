# Children on FishSpotter: how the service complies

**Operator:** Plant Ecology Beyond Land (PEBL) CIC, company no. 12076622
**Prepared:** 16 September 2026, by Claude (engineering analysis) for PEBL CIC
**Status:** Draft for director sign-off, and recommended for review by a data protection solicitor familiar with COPPA (see "Open items")
**Owner and security coordinator:** Christian Berger, director, PEBL CIC

This is the record of why FishSpotter treats children the way it does, what the law asks, where each requirement is met in the code, and what is still open. It is not legal advice. Read it with `docs/compliance/DPIA.md` (section 8) and the Online Safety Act assessments in `docs/safety/`.

---

## 1. What happened

On 16 September 2026 a catch-up email went to 39 unverified accounts. Ten went to US school addresses (ahschools.us 3, student.scusd.edu 3, thepegasusschool.org 3, a pre-K to 8th grade school, and oakdalechristian.org 1). All ten were guests who had saved their progress with an email address. Guest mode had never asked anyone's age, so the "13 and over" rule in the privacy policy was not enforced there. A read-only count that day found 129 of 135 accounts with no age on record.

So children use FishSpotter, very likely including US children under 13. The response was to decide, with the director:

- **Under-13s may play**, with a parent's consent needed to keep an account or receive a prize (rather than blocking them, which drives children to lie about their age).
- **Age is asked before a guest picks a username**, and once of every existing account.
- **Accounts with no age stay hidden** from public lists, and get no optional email and no prize, until they answer.
- **Prizes are posted to UK addresses only.**

## 2. The rules as built

The rules live in one module, `src/lib/age.ts`, and every surface calls it.

| Capability | Under 13 | 13 to 17 | 18+ | Not asked |
|---|---|---|---|---|
| Name | Generated nickname only (`src/lib/nickname.ts`) | Typed | Typed | Typed |
| Own email | Never | Yes | Yes | Not until asked |
| Public leaderboard, profile, comment name | Never | Off by default | On by default | Never |
| Post comments | No | Yes | Yes | No |
| Digest and new-clip emails | No | Opt-in | Opt-in | No |
| Streak reminder emails | No | No | Opt-in | No |
| Account analytics | No | With consent | With consent | No |
| AI ID-guide chat | No | No | Yes | No |
| Save account | Parent's consent | Own email | Own email | Must answer first |
| Prize | Parent's consent (account and prize) | Own confirmed email and parent's consent | Own confirmed email | Must answer first |

Where each rule is enforced:

- Age question: `src/components/age/AgeBandPicker.tsx`, `src/components/age/AgeCheck.tsx` (existing accounts), `src/components/guest/GuestGate.tsx` (guests), `src/app/auth/signin/page.tsx` (signup), `POST /api/account/age`.
- Account creation: `src/lib/auth.ts` (guest branch needs a band; under-13 guests need a generated nickname; signup refuses under-13s and never sees their email).
- Parental consent: `src/lib/parental-consent.ts`, `/api/parent/*`, `/parent`, `/parent/consent/[token]`, `/parent/manage/[token]`, emails in `src/lib/email/templates/Parent*.tsx`.
- Public naming: `canBePubliclyNamed` in `LeaderboardPanel`, `/api/leaderboard`, `/u/[id]`, `src/lib/comments.ts`.
- Emails: the `digest`, `new-clips` and `streak-nudge` crons and the opt-in routes.
- Analytics: `POST /api/events`. Chat: `POST /api/idguide/chat`.
- Prize: `prizeGate` in `src/lib/prize-requirements.ts`, `POST /api/prize/claim`, the desk at `/admin/prizes`.
- Retention: `purgeChildData` and the `child-data-retention` cron.
- Oversight: `/admin/children`.

## 3. US: COPPA (16 CFR Part 312, as amended 22 April 2025)

The amended rule took effect on 23 June 2025, with compliance required from 22 April 2026. The FTC's position is that a foreign service must comply if it knowingly collects personal information from US children under 13 (FAQ B.7), and a general-audience service is covered once it has actual knowledge, for example of a user's age or grade (FAQ H.1).

| Requirement | How FishSpotter meets it |
|---|---|
| Neutral age screen (312.2, FAQ D.7) | Three equal options including "Under 13"; no statement that under-13s lose anything; an under-13 answer is held for the tab (sessionStorage) and cannot be changed in-app. **Open:** the FTC's own example is month and year of birth; whether a band picker is neutral enough is not confirmed. |
| No collection before consent, except the exceptions (312.5(c)) | Under-13s give no name (generated nicknames), no email and no contact details. Their answers and the sign-in cookie are used only to run the game (support for internal operations). The parent's email is collected only to seek consent (312.5(c)(1)) and deleted if there is no answer within 14 days. |
| Verifiable parental consent (312.5(b)) | "Email plus" (312.5(b)(2)(viii)): allowed because under-13 information is never disclosed or made public. The parent answers an emailed link on a page that needs an explicit tap. A confirmation email follows at least a day later, repeats the notice and says how to withdraw. |
| Separate consent for third-party disclosure (312.5(a)(2)) | Not needed: nothing is disclosed. Hosting, database and email providers act only for PEBL (support for internal operations). |
| Direct notice (312.4(c)(1)) | `ParentConsentRequestEmail` with `ParentNotice`: address collected from the child, consent needed, what is collected, how it is used, that nothing is disclosed or made public, a link to the privacy policy, how to consent, and deletion if there is no answer. |
| Online notice (312.4(d)) | Privacy policy, "Children" section, linked from the home page footer, the guest start screen, the parent pages and the ask-a-parent form. **Open:** the rule asks for the operator's telephone number, which the policy does not yet give. |
| Parental rights (312.6) | `/parent/manage/[token]`: review and download, withdraw consent (which deletes the account and stops further collection), delete. Also by email to hello@. |
| Written data retention policy (312.10) | Section 5 below, published in the privacy policy, enforced daily by cron. |
| Written information security programme (312.8) | Section 6 below. |

Not relied on: the school-authorisation route (a school consenting for educational use). If a school asks to use FishSpotter with a class, ask for legal advice first.

## 4. UK

- **UK GDPR and DPA 2018.** Consent-based processing for under-13s needs a parent (Art. 8). FishSpotter relies on contract and legitimate interests for the game itself, and uses consent only where it must: analytics, which is never recorded for under-13s or unasked accounts, and a parent's consent for the child's account and prize. The Children's Wellbeing and Schools Act 2026 lets ministers raise the Art. 8 age to as much as 16 by regulations. It is still 13; watch for changes.
- **Data (Use and Access) Act 2025.** Section 81 added the "children's higher protection matters" duty to Art. 25 (in force 5 February 2026), which this change responds to. Section 103 added a complaints duty (in force 19 June 2026): the privacy policy now commits to acknowledging complaints within 30 days. **Open:** consider an online complaint form.
- **PECR.** A child under 13 cannot give cookie consent. The age-group storage is strictly necessary; analytics are skipped for under-13s.

### Children's Code, standard by standard

| Standard | Response |
|---|---|
| 1 Best interests | Children can take part safely instead of being pushed to lie; nothing about them is public. |
| 2 DPIA | `DPIA.md` section 8. |
| 3 Age-appropriate application | Self-declared band for everyone, with protections by band; unknown age treated as possibly a child. |
| 4 Transparency | A plain summary for young spotters at the top of the privacy policy; short explanations where data is asked for (guest start, ask-a-parent form, age question). |
| 5 Detrimental use | No "streak about to end" emails to under-18s; nothing is lost by pausing. |
| 6 Policies and community standards | Terms and prize rules match what the app enforces. |
| 7 Default settings | Under-18s private by default; under-13s always private. |
| 8 Data minimisation | Band, not date of birth; no child email; generated nicknames. |
| 9 Data sharing | None beyond processors. |
| 10 Geolocation | Not collected. |
| 11 Parental controls | The parent page; the child is told a grown-up is involved. |
| 12 Profiling | None. |
| 13 Nudge techniques | Neutral age question; no nudges to give more data. |
| 14 Connected toys | Not applicable. |
| 15 Online tools | Self-service delete and export; the parent page; report controls on comments. |

## 5. Children's data retention policy (COPPA 312.10)

| Information | Why it is kept | Deleted |
|---|---|---|
| A parent's email on an unanswered request | To ask for consent | When the request expires after 14 days (daily cron) |
| A parent's email on a declined request | n/a | Immediately |
| An under-13's nickname, identifications and points | To run the game for them | After 12 months with no identifications (daily cron), or at once when a parent deletes the account or withdraws consent |
| A parent's email on an account consent | To let the parent manage the account, and as evidence of consent | With the child's account |
| A parent's email on a prize consent | To arrange delivery, and as evidence of consent | 90 days after the prize is posted (daily cron), or when withdrawn |
| Hashed parent links | To make the links work | Once expired (daily cron) |
| A prize winner's postal address | To post the prize | Within 90 days of posting, by staff, from the mailbox it arrived in |

Deletion in the database runs in `purgeChildData` (`src/lib/parental-consent.ts`), which the `child-data-retention` cron calls at 05:00 UTC every day.

## 6. Information security programme for children's information (COPPA 312.8)

- **Coordinator:** Christian Berger, director, PEBL CIC.
- **What is protected:** the age band, generated nickname, identifications and points of child accounts; parents' email addresses and consent records; parent links; prize postal addresses.
- **Safeguards in place:**
  - encryption in transit (HTTPS);
  - database in the EU with row-level security on every public table, reached only through the server;
  - emailed tokens stored as SHA-256 hashes and short-lived;
  - rate limits on every parent route;
  - no-referrer and noindex on token pages;
  - staff pages gated to verified PEBL addresses, with parent addresses masked on `/admin/children`;
  - children's information never shown publicly or shared;
  - automated deletion (section 5).
- **Service providers:** Vercel, Supabase, Resend and Anthropic (adults only) hold written data processing terms, listed in the privacy policy. Check these still apply at each annual review.
- **Risk assessment and review:** at least once a year (next by 16 September 2027) and on any change to how children's information is handled. Record each review in this file.
- **Testing and monitoring:**
  - unit and integration tests (`src/lib/age.test.ts`, `src/lib/parental-consent.test.ts`, `src/lib/parental-consent.integration.test.ts`, `src/lib/prize*.test.ts`) run in CI on every pull request;
  - `/admin/children` shows the live state;
  - the cron logs what it deleted.
- **Incidents:** treat any exposure of a child's information as a personal data breach. Assess within 72 hours under UK GDPR Art. 33, and tell the affected parents.

## 7. Online Safety Act 2023

Clip comments allow replies to other users' comments, so the "comments on provider content" exemption (Schedule 1 para 4) very likely does not apply, and FishSpotter should be treated as a regulated user-to-user service. The illegal content and children's risk assessments in `docs/safety/` were adopted on 1 August 2026 on the basis that under-13s could not sign up. The 16 September changes are a significant change, and both assessments now carry a review section. **They need re-adopting by the director.**

Since 7 April 2026, s66 also requires reporting any child sexual exploitation and abuse content found on the service to the National Crime Agency.

## 8. Prizes

- **CAP Code.** The prize rules (`/prize-rules`) state:
  - how to take part;
  - that it is free;
  - the prize;
  - the UK-only and under-18 restrictions, including the adult permission (8.17.7, 5.6.1);
  - the promoter's name and address (8.17.9);
  - how and when winners are contacted (8.28.4);
  - that winners are not published (8.28.5);
  - delivery within 30 days (8.15.1).

  There is no fixed closing date; the rules promise 28 days' notice before an end. **Open:** CAP 5.6.2 expects a closing date for promotions aimed at children. The prize is not aimed at children, but a date may be the safer choice.
- **Gambling Act 2005.** It is not a lottery: it is free, including postage (Sch. 2 para 7), and decided by effort and skill, not chance (s14, s6).
- **Staff notification.** Every claim emails the verified PEBL admins (`src/lib/email/prize-notify.ts`), so the 7-day reply the rules promise is keepable.
- **Procedure for an under-18 winner:** write only to the parent or carer shown on `/admin/prizes`, never the spotter. Ask for a UK postal address, post the book, mark it posted, and delete the address from the mailbox within 90 days.

## 9. AI chat

Anthropic's usage policy (in force from 15 September 2025) requires extra safeguards before a product serves minors. The ID-guide chat is limited to declared adults. No page links to it today; if it is ever surfaced to younger users, the safeguards in Anthropic's guidance for organisations serving minors come first.

## 10. Remediation of existing accounts (16 September 2026)

- The 129 accounts without an age are hidden from public lists and get no optional email, no prize and no comment posting. The app asks them once on their next visit.
- An account that answers "under 13" loses its email address, password, pending links, social sign-in links, comments and usage events at once, has a typed display name replaced with a generated nickname, keeps its game progress, and is offered the parent route.
- **The ten school-address accounts (decided 16 September 2026): tell them, then remove the addresses.** Each gets one email from `/admin/children` (`src/lib/age-notice.ts`, template `AgePolicyNoticeEmail`). It says the rules have changed, explains the new process (the age question, nicknames and a parent for under-13s, a parent's OK for any prize to an under-18), and names the date the address will be removed, 14 days after sending. It does not ask for an age, invite a reply, or say which answer keeps what, so it does not nudge anyone to misstate their age (Children's Code standard 13). Finds and Pebbles stay.
  - **The removal** runs in the daily child-data job (05:00 UTC) on the UK date the email gave, whatever age the account declares in the meantime. An account that has not told us its age, or says it is under 13, gets the full under-13 strip (email, password, links, social sign-ins, comments, usage events). One that says 13 or over loses the address, password and links but keeps its comments. An under-13 answer before the date removes everything at once, as for any account.
  - **Why an email at all (the director's decision):** these addresses already received a transactional email the same day, and this one message only explains a change that reduces what we hold. Silent deletion would leave a pupil, parent or teacher unable to understand why sign-in stopped working. It is on the list for the legal review (section 11).
  - **Safeguards:** the admin previews the email and picks recipients; the server re-checks each account before sending (only saved accounts, only school-like domains, only if no age has been given, only once); an account told is never sent account links again (`verification-backlog.ts`); sends are spaced, and stop after two refusals.
- Check Resend for bounces from the 16 September send; school mail systems often reject outside senders.

## 11. Open items

1. **Legal review.** A short review by a UK data protection solicitor familiar with COPPA before relying on the under-13 route for US children, in particular:
   - the band picker's neutrality;
   - email plus under the amended rule;
   - whether the school domains amount to actual knowledge;
   - the one notice email to the ten school addresses before their removal (section 10).
2. **Telephone number** in the privacy policy (COPPA 312.4(d)(1)).
3. **Sign-offs:** DPIA section 8, this record, and re-adoption of both Online Safety Act assessments.
4. **Prize rules:** confirm the staff exclusion and the open-ended duration (or set a closing date).
5. **The ten school addresses:** resolved. Notify, then remove on the stated date (section 10). Confirm the send on `/admin/children` and check Resend for bounces afterwards.
6. **Complaints:** consider an online complaint form (Data (Use and Access) Act 2025 s103).
7. **Admin escalation:** the guest-claim path to a PEBL address is tracked as a separate task.

## Sources

Read on 16 September 2026:

- **COPPA:**
  - the amended rule, 90 FR 16918;
  - the eCFR text of Part 312;
  - the FTC COPPA FAQ;
  - the FTC age-verification policy statement of 25 February 2026.
- **UK:**
  - the ICO Children's Code, including standards 5, 7, 12 and 13 and Annex C;
  - the ICO guidance on storage and access technologies;
  - UK GDPR Art. 8;
  - Data (Use and Access) Act 2025 ss81, 103 and 112 and Sch. 12;
  - the Online Safety Act 2023 ss9, 11, 23, 35 to 37 and 66 and Schs. 1 and 3;
  - Ofcom's overview of regulated services, key dates, and quick guide to children's access assessments.
- **Prizes:** CAP Code sections 5, 8 and 10, and the Gambling Act 2005 ss6, 14 and 339 and Sch. 2.
- **AI:** the Anthropic Usage Policy, and its guidance for organisations serving minors.
