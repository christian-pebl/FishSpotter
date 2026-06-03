# Data Protection Impact Assessment (DPIA)

**Product:** FishSpotter (fish-spotter.vercel.app)
**Data Controller:** Plant Ecology Beyond Land (PEBL) CIC
**Companies House number:** 12076622
**Registered office:** PO Box SA29JA, 29 Glan Yr Afon Road, Sketty, Swansea, SA2 9JA
**Data protection contact:** hello@pebl-cic.co.uk
**Document date:** 3 June 2026
**Status:** Draft for director sign-off
**Framework:** UK GDPR / Data Protection Act 2018, ICO DPIA template structure

---

## 1. Identify the need for a DPIA

FishSpotter is a citizen-science web application operated by PEBL CIC. Users watch real underwater video clips of UK coastal sites, identify the marine species they see, and earn points and streaks on a community leaderboard. Quiz answers are aggregated and anonymised to build species-distribution datasets that support UK marine biodiversity science, which is part of PEBL CIC's registered community-benefit mission.

A DPIA is appropriate (and in places mandatory) here because the processing involves several of the factors the ICO flags as higher risk:

- **Children's personal data.** The service is open to users aged 13 and over. Processing of children's data, and the public display of children's identifiers on a leaderboard, is an ICO-listed trigger for a DPIA.
- **A public-facing element (the leaderboard)** that displays user-chosen display names alongside performance scores.
- **International transfers** of personal data to processors in the United States (Vercel hosting, Resend email).
- **Use of personal data for a secondary research purpose** (ecological datasets) distinct from the primary service purpose.
- **Some automated processing** (consensus-scoring) that affects a user's in-game score.

None of these is individually high-risk after mitigation, but the combination of children's data, a public surface, and a research re-use justifies a full DPIA. This assessment documents the processing, tests necessity and proportionality, scores the residual risks, and records the measures that bring those risks to an acceptable level.

This DPIA should be reviewed at the interval stated in section 7, and re-run before any of the following: introducing special-category data, lowering the minimum age, adding new processors, or changing the research-publication model.

---

## 2. Describe the processing

### 2.1 Nature of the processing

FishSpotter collects a small amount of account and gameplay data directly from the user via the web app. Data is stored in a Supabase Postgres database hosted in the EU (Ireland); video and thumbnail assets are stored in Cloudflare R2 and Supabase Storage; the application runtime is hosted on Vercel (US). Transactional email (account verification, password reset) is sent via Resend (US).

The processing is automated in the ordinary sense (a web app and database), with one specific automated decision routine: **consensus-scoring**, described in section 2.5.

### 2.2 Data inventory

| Data item | Source | Purpose | Lawful basis | Persisted? | Location |
|---|---|---|---|---|---|
| Email address | User | Account identity, login, transactional email | Contract (Art. 6(1)(b)) | Yes | Supabase (EU) |
| Display name | User | Leaderboard / public identity | Contract | Yes | Supabase (EU) |
| Hashed password (bcrypt) | User | Authentication | Contract | Yes (hash only) | Supabase (EU) |
| Quiz answers (species guess + timestamp) | User | Scoring, gameplay; **aggregated/anonymised** for research | Contract (gameplay); Legitimate interests (Art. 6(1)(f), research, see LIA) | Yes | Supabase (EU) |
| Age band (13_17 / 18_plus, self-declared) | User | Apply under-18 protections (leaderboard default off) | Legal obligation / child-protection duty; Contract | Yes | Supabase (EU) |
| Leaderboard opt-in flag | User | Honour user choice on public display | Consent (Art. 6(1)(a)) for the public display | Yes | Supabase (EU) |
| Session cookie (NextAuth) | System | Keep the user logged in (strictly necessary) | Contract / strictly-necessary cookie | Yes (cookie) | Browser + Vercel |
| `fs.anon_seed` functional cookie | System | Stable per-browser feed ordering for anonymous users | Consent (functional cookie, consent-gated) | Yes (cookie) | Browser |
| `pebl_consent` cookie | System | Record the user's cookie-consent choice | Legal obligation (PECR record) | Yes (cookie) | Browser |
| IP address | Request | In-memory rate-limiting / abuse prevention | Legitimate interests (Art. 6(1)(f), see LIA) | **No — in-memory only, not written to the database** | Vercel runtime (transient) |
| Vercel server access logs | System | Operational / security logging by the processor | Legitimate interests (Art. 6(1)(f)) | Yes (processor-side, short retention) | Vercel (US) |

No special-category data (Art. 9) and no criminal-offence data (Art. 10) are processed. Age band is **not** treated as health/biometric data; it is a coarse self-declared flag used only to apply child-protection defaults.

### 2.3 Data-flow description

1. A visitor loads the app from Vercel (US edge/runtime). A cookie-consent banner records the choice in `pebl_consent`. Functional cookies (`fs.anon_seed`) are only set if consent is given; the strictly-necessary session cookie is set on login regardless.
2. On sign-up, the user submits email, display name, password and self-declared age band. The password is hashed with bcrypt before storage; the plaintext is never persisted. The record is written to Supabase Postgres (EU).
3. Account-verification and password-reset emails are dispatched via Resend (US).
4. During play, the app serves video clips from Cloudflare R2 / Supabase Storage. The user submits species guesses; each answer (guess + timestamp + outcome/points) is written to Supabase (EU).
5. Every inbound request passes through an in-memory rate-limiter keyed on IP address. The IP is held only in the running process memory for the rate-limit window and is **never written to the database**. Vercel independently keeps short-lived server access logs as part of its hosting service.
6. The leaderboard reads display name + score for users who have opted in. **Under-18 users default to off the public leaderboard.**
7. For research, quiz answers are aggregated and anonymised (stripped of user identifiers and reduced to species-distribution counts by site/time) **before** any dataset is produced or published. Identifiable answer rows are not published.

### 2.4 Scope

- **Volume:** small, citizen-science scale. One row per account; a handful of cookies; one answer row per guess.
- **Geography:** primarily UK users; storage in the EU; runtime/email touch the US under transfer safeguards (section 4.5).
- **Duration / retention:** see section 4.4.
- **Individuals:** members of the public aged 13+, including children aged 13–17.

### 2.5 Context and purposes

**Primary purposes:**
1. Provide the FishSpotter game (accounts, play, scoring, leaderboard).
2. Send necessary transactional email.
3. Protect the service from abuse (rate-limiting).

**Secondary purpose:**
4. Produce **anonymised, aggregated** species-distribution datasets for UK marine biodiversity research, in furtherance of PEBL CIC's community-benefit mission.

**Automated processing — consensus-scoring.** When three or more distinct users converge on the same species ID for a clip that has no reference answer, the system retro-awards points to those matching answers. This affects only the user's in-game score. It produces **no legal or similarly significant effect** on any individual and therefore does **not** engage Article 22. It is documented here for transparency, not because it is solely-automated decision-making of the kind Art. 22 restricts.

---

## 3. Consultation process

| Stakeholder | How consulted | Outcome reflected |
|---|---|---|
| PEBL CIC director (controller) | Reviews and signs off this DPIA | Sign-off in section 7 |
| Engineering (data architecture) | Confirmed the data inventory, the EU storage location, the in-memory-only IP handling, and the bcrypt/consent/under-18 controls already in the codebase | Sections 2 and 6 |
| Data subjects (users) | Represented via the published privacy notice and cookie-consent flow; reasonable expectations assessed in the LIA balancing tests | Sections 4, 5, 6 and the companion LIA |
| Processors (Vercel, Supabase, Resend, Cloudflare) | Standard processing terms / DPAs and transfer mechanisms reviewed | Sections 4.5 and 6 |
| ICO | Not consulted; residual risk is low and prior consultation under Art. 36 is not required | Section 7 |

If a future change pushes any residual risk to "high" without adequate mitigation, prior consultation with the ICO under Article 36 will be sought before that processing begins.

---

## 4. Necessity and proportionality

### 4.1 Lawful basis per purpose

| Purpose | Lawful basis | Justification |
|---|---|---|
| Run accounts, play, scoring, leaderboard | **Contract** (Art. 6(1)(b)) | Processing email, display name, password hash and answers is necessary to deliver the service the user signed up for. |
| Public display of name + score on the leaderboard | **Consent** (Art. 6(1)(a)) via the leaderboard opt-in flag | The user controls whether their identity appears publicly; opt-in is revocable. |
| Transactional email | **Contract** | Verification and password reset are intrinsic to the account. |
| Apply under-18 protections | **Legal obligation / child-protection duty**; supported by Contract | Required to honour the Children's Code and protect children on the public surface. |
| Anonymised ecological research | **Legitimate interests** (Art. 6(1)(f)) — see companion LIA | Personal data is used only transiently as input; the output is anonymised aggregate. Necessary, proportionate, balanced. |
| IP rate-limiting / abuse prevention | **Legitimate interests** (Art. 6(1)(f)) — see companion LIA | Necessary for security; minimal data, transient, not persisted. |
| Functional cookie (`fs.anon_seed`) | **Consent** (PECR + Art. 6(1)(a)) | Set only after cookie consent. |
| Session cookie | **Strictly necessary** (PECR) / Contract | No consent required; needed to keep the user logged in. |
| Vercel access logs | **Legitimate interests** (Art. 6(1)(f)) | Standard operational/security logging by the processor. |

### 4.2 Necessity

Each item in the data inventory maps to a specific purpose and there is no less-intrusive alternative that still delivers it. The service genuinely needs an email (login + account recovery), a display name (identity / leaderboard), and answer records (the entire point of the game). Age band is the minimum needed to apply child protections. No "nice to have" personal data is collected.

### 4.3 Data minimisation

- No real name, address, phone number, date of birth, location, device fingerprint, or marketing/analytics tracking is collected.
- Age is a coarse two-value band, not a full date of birth.
- The password is stored only as a bcrypt hash.
- IP addresses are held only in process memory for rate-limiting and are never written to the database.
- Research outputs are anonymised aggregates; raw identifiable answers are never published.

### 4.4 Retention

| Data | Retention |
|---|---|
| Account data (email, display name, password hash, age band) | For the life of the account; deleted on account deletion request, save where a shorter or longer period is required by law. |
| Quiz answers (identifiable) | For the life of the account, to support the user's own score/history; deleted on account deletion. |
| Anonymised research aggregates | Retained indefinitely as scientific datasets — but they are **not personal data** once anonymised, so retention limits do not bite. |
| Cookies | Per their stated lifetimes; `pebl_consent` retains the consent record per ICO guidance. |
| IP (rate-limit) | Seconds-to-minutes in memory; never persisted. |
| Vercel access logs | Processor's short standard retention. |

[TO COMPLETE: confirm exact account-data and access-log retention periods and publish them in the privacy notice.]

### 4.5 Processor safeguards and international transfers

| Processor | Role | Location | Transfer mechanism |
|---|---|---|---|
| Supabase | Database + storage | Ireland / EU | **No restricted transfer** (data stays in the EEA; UK adequacy with the EEA applies). |
| Vercel | Application hosting / runtime + access logs | United States | **UK IDTA + EU SCCs** under the processor DPA. |
| Resend | Transactional email | United States | **EU SCCs + UK Addendum** under the processor DPA. |
| Cloudflare R2 | Video / thumbnail storage | Distributed | Processing terms / DPA in place; assets are non-personal media. |

All processors are bound by Art. 28 processing terms. US transfers are covered by the UK IDTA and/or EU SCCs with the UK Addendum, and limited to the minimum data each processor needs (Vercel: request/runtime data and logs; Resend: recipient email + message). A transfer-risk assessment supports the conclusion that, with these clauses plus the limited and low-sensitivity nature of the data, the transfers offer essentially equivalent protection.

---

## 5. Identify and assess risks

Scoring: Likelihood and Severity each rated Low / Medium / High; Overall is the combined risk to individuals **before** the section 6 measures are weighed in full (it already assumes the architecture as built).

| # | Risk to individuals | Likelihood | Severity | Overall |
|---|---|---|---|---|
| R1 | **Re-identification from "anonymised" research data** — aggregates could in theory be re-identified if granular enough or combined with other data. | Low | Medium | **Low–Medium** |
| R2 | **Children's data exposed on the public leaderboard** — a 13–17 user's display name + score visible publicly, risking unwanted contact or profiling. | Low | High | **Medium** |
| R3 | **US transfer risk** — government access or weaker protection for data sent to Vercel/Resend. | Low | Medium | **Low–Medium** |
| R4 | **Breach of the account store** — email + display name + bcrypt hash exposed, enabling phishing or (if hashes cracked) credential stuffing. | Low | Medium | **Low–Medium** |
| R5 | **Unexpected secondary use** — users surprised that gameplay answers feed research. | Low | Low | **Low** |
| R6 | **Excessive/persisted IP processing** — IP used beyond rate-limiting, or retained, enabling tracking. | Low | Low | **Low** |
| R7 | **Self-declared age bypass** — a child mis-declares as 18+ and loses the under-18 protections. | Medium | Medium | **Medium** |
| R8 | **Cookie consent not honoured** — functional/tracking cookies set without consent. | Low | Low | **Low** |

---

## 6. Measures to reduce risk

| Risk | Measures | Effect on risk | Residual |
|---|---|---|---|
| R1 Re-identification | Aggregate and anonymise quiz answers (strip user identifiers; reduce to species counts by site/time) **before** any dataset is produced or published; never publish raw identifiable rows; apply a minimum-aggregation/small-count check before release. | Reduces likelihood and severity | **Low** |
| R2 Children on leaderboard | **Under-18 users default to off the public leaderboard.** Leaderboard display is consent-gated (opt-in flag) for everyone. Display names are user-chosen pseudonyms, not real names. | Reduces severity sharply | **Low** |
| R3 US transfer | UK IDTA (Vercel) and EU SCCs + UK Addendum (Resend); EU-resident primary store (Supabase) so the bulk of personal data never leaves the EEA; data sent to US processors is minimised and low-sensitivity. | Reduces likelihood/severity | **Low** |
| R4 Account breach | Passwords stored as **bcrypt hashes only**; EU-hosted managed Postgres with access controls; no special-category data; minimal account fields to reduce blast radius; breach-response process. | Reduces severity | **Low** |
| R5 Secondary use | Transparent privacy notice explaining the research purpose and the LI basis; LIA completed; research output is anonymised. | Reduces likelihood | **Low** |
| R6 IP processing | IP held **in process memory only** for the rate-limit window; **never written to the database**; used solely for abuse prevention. | Reduces likelihood/severity | **Low** |
| R7 Age bypass | Self-declared age band with under-18 defaults; pseudonymous display names; no collection of data that would make a mis-declaring child more identifiable. Review whether additional age-assurance is proportionate if the user base grows. | Reduces severity | **Low–Medium** |
| R8 Cookie consent | `pebl_consent` records the choice; functional `fs.anon_seed` is **consent-gated**; only the strictly-necessary session cookie is exempt. | Reduces likelihood | **Low** |

Cross-cutting measures: data minimisation by design (section 4.3); Art. 28 DPAs with every processor; a published privacy notice and accessible data-subject-rights route via hello@pebl-cic.co.uk; this DPIA and the companion LIA kept under review.

---

## 7. Sign-off and outcome

### 7.1 Residual-risk summary

| Risk | Residual rating | Accepted? |
|---|---|---|
| R1 Re-identification | Low | Yes |
| R2 Children on leaderboard | Low | Yes |
| R3 US transfer | Low | Yes |
| R4 Account breach | Low | Yes |
| R5 Secondary use | Low | Yes |
| R6 IP processing | Low | Yes |
| R7 Age bypass | Low–Medium | Yes, with periodic review of age-assurance proportionality |
| R8 Cookie consent | Low | Yes |

### 7.2 Outcome

All residual risks are assessed as **Low** (R7 Low–Medium). No residual high risk remains, so **prior consultation with the ICO under Article 36 is not required.** The processing may proceed subject to the measures in section 6 and the review commitment below.

### 7.3 Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| DPIA prepared by | [TO COMPLETE: preparer name] | Submitted for approval | 3 June 2026 |
| Reviewed / approved by (PEBL CIC director, acting controller) | [TO COMPLETE: director name] | [TO COMPLETE: approve / approve-with-conditions / reject] | [TO COMPLETE: sign-off date] |
| Integrate measures into the project? | — | Yes — measures in section 6 are implemented or scheduled | 3 June 2026 |
| Next scheduled review | — | — | [TO COMPLETE: review date — recommend within 12 months or on any material change] |

---

*Plant Ecology Beyond Land (PEBL) CIC — company no. 12076622. Contact: hello@pebl-cic.co.uk. Prepared 3 June 2026.*
