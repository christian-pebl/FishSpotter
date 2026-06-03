# Privacy Policy

**Last updated: 3 June 2026**

## Who we are

FishSpotter is operated by **Plant Ecology Beyond Land (PEBL) CIC**, a Community Interest Company registered in England and Wales (company number **12076622**). Our registered office is **PO Box SA29JA, 29 Glan Yr Afon Road, Sketty, Swansea, United Kingdom, SA2 9JA**. Our registered contact email is [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk) and our website is [pebl-cic.co.uk](https://pebl-cic.co.uk).

We are the data controller for the personal data described in this policy. We process data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Privacy and Electronic Communications Regulations 2003 (PECR).

---

## What data we collect and why

| Data | Purpose | Lawful basis |
|------|---------|-------------|
| Email address | Account creation, login, transactional emails | Contract (UK GDPR Art. 6(1)(b)) |
| Display name | Leaderboard, community stats | Contract |
| Hashed password | Authentication (bcrypt; your plain-text password is never stored) | Contract |
| Quiz answers (species guesses, timestamps) | Score calculation, streak, community identification statistics, ecological research | Contract; Legitimate interests — generating anonymised, aggregated species-distribution datasets for UK marine biodiversity science (Art. 6(1)(f)) |
| IP address | Rate-limiting and abuse prevention (held in memory only; never persisted; cleared on server restart) | Legitimate interests — preventing abuse and protecting service availability |
| Server access logs (IP, User-Agent, request path, timestamp) | Security, debugging, abuse prevention | Legitimate interests |
| Cookies (see Cookies section) | Keeping you signed in; stable personalised feed ordering | Strictly necessary (session); Consent (functional) |

We do not collect payment data, precise device location, or any special-category data.

Server access logs are generated and retained by **Vercel**, our hosting sub-processor, in accordance with Vercel's own log-retention period; we do not maintain a separate persistent copy.

For the quiz-answer research processing carried out under legitimate interests, PEBL maintains a Legitimate Interests Assessment and, where required, a Data Protection Impact Assessment, available on request. Research outputs use only pseudonymised or aggregated data, in line with the safeguards for scientific research processing under UK GDPR Art. 89.

---

## How we use your data

- To authenticate you and maintain your account.
- To calculate your points, streak, and leaderboard rank.
- To aggregate quiz answers in anonymised form so the community can see identification trends per clip.
- To send transactional emails (account verification, password reset) via our email processor, Resend.
- To support ecological research into UK marine biodiversity by PEBL CIC as part of our community-benefit mission. Any research outputs use aggregated, anonymised data only.

### Automated processing of community identifications

We use automated processing to aggregate community identifications. When three or more users independently submit the same identification for a clip that has no reference answer, our system records a community consensus and may retroactively award points to those users. This affects only your score within the game and has no legal or similarly significant effect on you, so it is not solely-automated decision-making of the kind restricted by UK GDPR Article 22.

---

## Third-party processors

We share data only with the processors listed below, each under a contract that requires them to protect your data:

| Processor | Role | Location | International transfer mechanism |
|-----------|------|----------|----------------------------------|
| **Vercel** | Application hosting and edge delivery | US | UK International Data Transfer Agreement (IDTA), incorporated into the Vercel DPA, layered with the EU Standard Contractual Clauses (Commission Decision 2021/914) |
| **Supabase** | Database and video/thumbnail file storage | West EU (AWS eu-west-1, Dublin, Republic of Ireland) — personal data stays within the EU/EEA | No transfer outside the UK/EEA |
| **Resend** | Transactional email delivery | US | EU Standard Contractual Clauses (Commission Decision 2021/914) as amended by the UK Addendum (UK International Data Transfer Addendum), incorporated into the Resend DPA |

Where we transfer personal data outside the UK, we rely on an appropriate safeguard under UK GDPR Article 46 (such as the UK-US Data Bridge, the UK International Data Transfer Agreement, or the UK Addendum to EU Standard Contractual Clauses), as noted per processor above.

We also read publicly available ecological data from **iNaturalist**, **GBIF**, and **OBIS** to populate the species photo cache and probability data. We do not send them any information about you.

We do not sell your data. We do not use advertising networks or social-media tracking pixels.

---

## Cookies

We use the following first-party cookies:

| Cookie | Type | Duration | Purpose | Consent |
|--------|------|----------|---------|---------|
| **NextAuth session** | Strictly necessary | Until sign-out or after a period of inactivity | A signed, HTTP-only token that keeps you authenticated | Exempt from consent under PECR Reg. 6(1) |
| **fs.anon_seed** | Functional / preferences | ~12 months | Stable, personalised feed ordering for anonymous visitors (deterministic shuffle that stays consistent across page loads) | Covered by the consent banner |
| **Consent preference** [CONFIRM cookie name] | Strictly necessary | ~12 months | Records your cookie-consent choice so we do not ask again on every visit | Exempt from consent under PECR Reg. 6(1) |

The **fs.anon_seed** cookie is a functional cookie, not strictly necessary, so it is covered by the consent banner shown on your first visit; we only set it where consent permits. You can withdraw your consent for functional cookies at any time by clearing your cookies or by using the cookie controls on the site.

We do not currently deploy analytics cookies. If we add optional cookies in future, we will ask for your consent via the banner shown on your first visit before setting them.

---

## How long we keep your data

- **Account data** (email, display name, hashed password): retained while your account is active and for **24 months after your last sign-in**, after which we prompt you or delete it.
- **Quiz answers linked to your account**: retained for the same period as your account data.
- **Anonymised aggregates** derived from quiz answers: retained indefinitely for ecological research purposes; they cannot be used to identify you.
- **IP addresses**: held in memory only, never persisted, cleared on server restart.
- **Server access logs**: retained by Vercel, our hosting sub-processor, per Vercel's log-retention period (see "What data we collect and why").
- **Survey footage** (the underwater video clips): scientific data collected by PEBL CIC in the field and retained indefinitely. Clips do not contain personal data.

Separately, if you make an erasure request, we will respond and delete your personal data within 30 days. (This is our response time, not a retention period.)

---

## Your rights under UK GDPR

You have the right to:

- **Access** — request a copy of the data we hold about you (available at [/api/account/export](/api/account/export) when signed in, or by emailing us).
- **Rectification** — correct inaccurate or incomplete data.
- **Erasure** — ask us to delete your account and associated personal data (Art. 17). Email [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk) with the subject "Erasure request".
- **Portability** — receive your quiz answers in a machine-readable format.
- **Object** — object to processing we carry out under legitimate interests (for example, the research use of quiz answers, or abuse-prevention use of your IP address and access logs). If you object, we will stop that processing unless we can show compelling legitimate grounds that override your interests, rights, and freedoms, or that the processing is needed to establish, exercise, or defend legal claims.
- **Restrict processing** — ask us to pause processing while a dispute is resolved.

Where processing relies on your consent (currently only the **fs.anon_seed** functional cookie), you can withdraw that consent at any time through the site's cookie controls or by clearing your cookies; this does not affect the lawfulness of processing before withdrawal.

To exercise any of these rights, email [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk). We will respond within one calendar month.

---

## Minimum age

FishSpotter is intended for users aged **13 and over**. If you believe we have collected data from a child under 13, please contact us immediately and we will delete it.

---

## Complaints

If you have a concern about how we handle your data, please contact us first at [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk). You also have the right to lodge a complaint with the **UK Information Commissioner's Office (ICO)** at [ico.org.uk](https://ico.org.uk) or by calling 0303 123 1113.

---

## Changes to this policy

If we make material changes, we will update the "Last updated" date above and, where appropriate, notify you by email.
