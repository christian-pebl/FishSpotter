# Privacy Policy

**Last updated:** 2026-05-21 · **Version:** v0.1 (engineering draft — pending legal review)

> ⚠️ This document is a scaffolding placeholder. Plant Ecology Beyond Land (PEBL) CIC legal counsel will finalise the wording before public launch. The structure below follows the UK ICO "Privacy notice checklist" so the engineering scaffold matches the regulatory expectations.

## Who we are

Plant Ecology Beyond Land (PEBL) CIC is a Community Interest Company registered in England and Wales, company number **12082722**. We operate FishSpotter at <https://fish-spotter.vercel.app> as part of our marine-monitoring programme. Our registered contact email is [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk).

## What information we collect

- **Account data**: the email address you give us at sign-up and a display name you choose.
- **Authentication data**: a hashed password (we never store your plain-text password). We use industry-standard bcrypt with a cost factor of 12.
- **Behavioural data**: the answers you submit to the species-identification quiz, with timestamps.
- **Network data**: IP address (held briefly in memory for rate-limiting; not persisted to the database).
- **Cookies**: a single strictly-necessary cookie that holds your signed-in session token.

## How we use it

- To authenticate you on subsequent visits.
- To compute your daily streak and leaderboard rank.
- To improve the species catalogue by aggregating community answers in anonymised form.
- To send you a weekly digest of your activity, **if** you opt in. You can opt out from your account page or by clicking unsubscribe in any digest email.

## Lawful basis (UK GDPR Art. 6)

- **Contract** for everything required to operate your account (sign-in, quiz submission, streak calculation).
- **Consent** for the optional weekly digest emails (PECR Reg. 22).
- **Legitimate interest** for the abuse-prevention rate-limit (we never persist your IP).

## How long we keep it

- Account data and your answers are kept for as long as your account exists.
- If you delete your account (see "Your rights"), all of the above is removed within 24 hours.
- Aggregate, fully-anonymised statistics may be retained for ecological research outputs.

## Who we share it with

- **Vercel** (US, EU sub-processor) — hosts the application.
- **Supabase** (West EU / Ireland) — hosts our database and the snippet videos.
- **Resend** — delivers the verification, password-reset, and digest emails.
- **iNaturalist, OBIS, GBIF** — we read public ecological data from these sources; we do not send them anything about you.

We do not sell your data.

## Your rights (UK GDPR Art. 12–22)

You have the right to:

- access the data we hold on you;
- correct it;
- delete your account (Art. 17 — see "Delete account" on your account page);
- object to processing for legitimate interest;
- withdraw consent for the optional digest at any time.

To exercise any right not exposed in the UI, email [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk).

## Cookies

We set exactly one cookie: a session token used to keep you signed in. This is strictly necessary and is not used for tracking. The PECR-compliant disclosure banner you saw on first visit links here.

## Complaints

If you have a concern, please email us first at [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk). You also have the right to complain to the UK Information Commissioner's Office at [ico.org.uk](https://ico.org.uk).
