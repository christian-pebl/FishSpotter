# Legitimate Interests Assessment (LIA)

**Product:** FishSpotter (fish-spotter.vercel.app)
**Data Controller:** Plant Ecology Beyond Land (PEBL) CIC
**Companies House number:** 12076622
**Registered office:** PO Box SA29JA, 29 Glan Yr Afon Road, Sketty, Swansea, SA2 9JA
**Data protection contact:** hello@pebl-cic.co.uk
**Document date:** 3 June 2026
**Status:** Draft for director sign-off
**Framework:** UK GDPR Art. 6(1)(f); ICO three-part legitimate-interests test

---

## Scope

This LIA covers the two FishSpotter processing activities that rely on **legitimate interests (Art. 6(1)(f))** as their lawful basis:

- **Activity A** — using users' quiz answers to produce anonymised, aggregated ecological-research datasets.
- **Activity B** — processing users' IP addresses for rate-limiting and abuse prevention.

All other processing relies on contract, consent, legal obligation, or the strictly-necessary cookie exemption, and is documented in the companion DPIA rather than here. Each activity below is taken through the ICO's three-part test (purpose, necessity, balancing) and closed with an outcome.

---

## Activity A — Quiz answers for anonymised ecological research

### A.1 Purpose test — is there a legitimate interest?

PEBL CIC is a community-interest company whose mission is marine and coastal ecological benefit. FishSpotter's players identify species in real underwater clips from UK sites; aggregating those identifications yields **species-distribution datasets that support UK marine biodiversity science.** Producing and sharing such datasets is a clear, specific and lawful interest, and it carries a wider public benefit (conservation, marine evidence) beyond PEBL's own.

The interest is both PEBL's (delivering its registered community-benefit purpose) and the public's (open ecological evidence). It is real and present, not speculative.

**Legitimate interest identified:** generating anonymised, aggregated species-distribution data for UK marine biodiversity research and conservation, in furtherance of PEBL CIC's community-benefit mission. **Pass.**

### A.2 Necessity test — is the processing necessary?

The dataset cannot be built without the species identifications, and those identifications are exactly the quiz answers users already submit as part of play. Using them for research is therefore a targeted re-use of data the controller already holds, not new collection.

Could it be done another way? Consent was considered but is a poor fit: the processing of the answer as a research input is low-risk and the published output is anonymised, so a separate consent gate would add friction without materially improving protection, and would fragment the dataset (consent-decliners would create gaps that bias the ecology). The processing is limited to what the research needs: the species guess plus its site/time context, aggregated and stripped of identifiers before any dataset is produced. No less-intrusive route delivers the same scientific purpose.

**The processing is necessary and proportionate to the purpose. Pass.**

### A.3 Balancing test — do the individual's interests override?

- **Nature of the data:** a species guess and a timestamp. Not special-category, not sensitive, not financial, not revealing of private life. The identifying element (which user guessed) is used only transiently as an input and is removed before publication.
- **Reasonable expectations:** a citizen-science game whose stated purpose is marine biodiversity is one where players reasonably expect their identifications to contribute to science. The privacy notice states this. This aligns with, rather than surprises, the user.
- **Possible impact on individuals:** minimal. The published output is anonymised aggregate, so there is no individual-level effect from the research output. The main theoretical harm is re-identification, addressed by the safeguards below.
- **Children:** users may be 13+. Because the research output is anonymised and the input is a single low-sensitivity data point, the additional risk to children is low. No child is individually identifiable in any published dataset.
- **Safeguards:** aggregate-and-anonymise before producing or publishing any dataset; never publish raw identifiable answer rows; apply a small-count/minimum-aggregation check before release; transparent privacy notice; data-subject rights (including objection) honoured via hello@pebl-cic.co.uk.
- **Opt-out / right to object:** users can object to this processing under Art. 21. Because the basis is legitimate interests (not a contractual necessity), an objection is honoured by excluding that user's answers from future research aggregation. This is offered as a clear, accessible route.

Weighing these, the individual's interests, rights and freedoms do **not** override PEBL's (and the public's) legitimate interest. The data is low-sensitivity, the use is expected, the output is anonymised, and an objection route exists.

**Outcome:** **Legitimate interests applies** as the lawful basis for using quiz answers to produce anonymised ecological-research datasets.

**Safeguards relied on:** anonymisation/aggregation before publication; small-count suppression; no publication of identifiable rows; transparent privacy notice; Art. 21 objection (per-user exclusion from future aggregation).

---

## Activity B — IP addresses for rate-limiting / abuse prevention

### B.1 Purpose test — is there a legitimate interest?

FishSpotter is a public web app with account creation, login, and a scored leaderboard. Without abuse controls it is exposed to brute-force login attempts, automated sign-up/spam, scraping, and denial-of-service. Protecting the service, its users, and the integrity of the leaderboard and datasets is a legitimate interest, and the UK GDPR expressly recognises that processing strictly necessary for network and information security can constitute a legitimate interest (Recital 49).

**Legitimate interest identified:** protecting the security, availability and integrity of FishSpotter and its users by rate-limiting requests to prevent abuse. **Pass.**

### B.2 Necessity test — is the processing necessary?

Rate-limiting inherently requires an identifier to count requests per source within a window; the IP address is the standard, minimal identifier for this. No less-intrusive identifier would reliably distinguish request sources for abuse prevention. The processing is tightly scoped: the IP is held **only in process memory** for the duration of the rate-limit window and is **never written to the database**. It is used solely to decide whether a source has exceeded its request budget.

There is no equally effective alternative that avoids processing an IP entirely, and the chosen design already minimises the processing to the bare minimum (transient, in-memory, non-persisted).

**The processing is necessary and proportionate. Pass.**

### B.3 Balancing test — do the individual's interests override?

- **Nature of the data:** an IP address — personal data, but low-sensitivity in this context and not linked to account identity for this purpose.
- **Reasonable expectations:** users reasonably expect a public web service to defend itself against abuse; transient IP-based rate-limiting is a ubiquitous, expected security control.
- **Possible impact on individuals:** negligible. The IP is not stored, not profiled, not used to track behaviour, and not combined with other data. The only effect on a legitimate user is none; an abusive source is temporarily throttled.
- **Children:** the transient, non-persisted, security-only nature means no heightened risk to under-18 users.
- **Safeguards:** in-memory-only; never persisted to the database; used solely for rate-limiting; no profiling or cross-context tracking; separate from the (processor-side, short-retention) Vercel access logs.
- **Opt-out:** an opt-out is neither feasible nor appropriate for a security control of this kind, but the minimal, transient, non-persisted design means the absence of opt-out does not tip the balance against the individual.

The individual's interests do **not** override the legitimate interest. The processing is the minimum necessary for a widely expected security purpose, is transient and non-persisted, and has negligible impact on individuals.

**Outcome:** **Legitimate interests applies** as the lawful basis for processing IP addresses for rate-limiting and abuse prevention.

**Safeguards relied on:** in-memory-only processing; no database persistence; single security purpose; no profiling/tracking; minimal retention (request window only).

---

## Summary of outcomes

| Activity | Lawful basis | Three-part test | Outcome |
|---|---|---|---|
| A — Quiz answers for anonymised ecological research | Art. 6(1)(f) | Purpose ✓ Necessity ✓ Balancing ✓ | **LI applies** |
| B — IP addresses for rate-limiting / abuse prevention | Art. 6(1)(f) | Purpose ✓ Necessity ✓ Balancing ✓ | **LI applies** |

Both activities are recorded as relying on legitimate interests in PEBL CIC's records of processing, and the legitimate-interests basis (with the right to object for Activity A) is disclosed in the FishSpotter privacy notice.

---

## Review

This LIA must be re-assessed if any of the following change: the sensitivity or granularity of quiz-answer data, the anonymisation/publication model, the use or retention of IP addresses, the minimum user age, or the addition of profiling. Otherwise it is reviewed on the cycle below.

| Item | Detail |
|---|---|
| Prepared by | [TO COMPLETE: preparer name] |
| Approved by (PEBL CIC director, acting controller) | [TO COMPLETE: director name] |
| Approval date | [TO COMPLETE: sign-off date] |
| Next scheduled review | [TO COMPLETE: review date — recommend within 12 months or on any material change] |

---

*Plant Ecology Beyond Land (PEBL) CIC — company no. 12076622. Contact: hello@pebl-cic.co.uk. Prepared 3 June 2026.*
